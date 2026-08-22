import "server-only";

import {
  AnchorEventType,
  AnchorStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toBytes,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

import { prisma } from "../prisma";

export const BLOCKCHAIN_SCHEMA_VERSION = "anchor-v1.0";
export const CARBONX_ANCHOR_ABI = [
  {
    type: "function",
    name: "anchor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "incidentId", type: "bytes32" },
      { name: "evidenceHash", type: "bytes32" },
      { name: "eventType", type: "string" },
    ],
    outputs: [],
  },
] as const;

const ANCHOR_EVENT_TYPES = [
  AnchorEventType.UNDER_ASSESSMENT,
  AnchorEventType.AUDIT_RECOMMENDED,
  AnchorEventType.RESOLVED,
] as const;

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export type CanonicalAssessment = {
  id: string;
  incidentId: string;
  engineVersion: string;
  methodologyVersion: string;
  integrityRisk: string;
  evidenceConfidence: string;
  inputEvidenceIds: string[];
  boundaryId: string;
  createdAt: Date;
};

export type CanonicalEvidenceRecord = {
  schemaVersion: typeof BLOCKCHAIN_SCHEMA_VERSION;
  incidentId: string;
  assessmentId: string;
  engineVersion: string;
  methodologyVersion: string;
  integrityRisk: string;
  evidenceConfidence: string;
  inputEvidenceIds: string[];
  boundaryId: string;
  timestamp: string;
  eventType: AnchorEventType;
};

export type AnchorTransport = {
  submit(input: {
    incidentIdHash: Hex;
    evidenceHash: Hex;
    eventType: AnchorEventType;
  }): Promise<Hex>;
  waitForConfirmation?(txHash: Hex): Promise<Date>;
};

export type BlockchainServiceOptions = {
  contractAddress?: string;
  network?: string;
  transport?: AnchorTransport;
};

export type AnchorResult = {
  anchorId: string | null;
  status: AnchorStatus;
  hash: Hex;
  txHash: Hex | null;
  eventType: AnchorEventType;
  failureReason: string | null;
};

type AnchorConfig = {
  contractAddress: `0x${string}`;
  network: string;
};

function isAnchorEventType(value: string): value is AnchorEventType {
  return (ANCHOR_EVENT_TYPES as readonly string[]).includes(value);
}

function assertAnchorEventType(value: string): asserts value is AnchorEventType {
  if (!isAnchorEventType(value)) {
    throw new Error("Unsupported blockchain anchor event type");
  }
}

function isContractAddress(value: string | undefined): value is `0x${string}` {
  return Boolean(value && /^0x[0-9a-fA-F]{40}$/.test(value));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export function buildCanonicalEvidenceRecord(
  assessment: CanonicalAssessment,
  eventType: AnchorEventType,
): CanonicalEvidenceRecord {
  assertAnchorEventType(eventType);
  return {
    schemaVersion: BLOCKCHAIN_SCHEMA_VERSION,
    incidentId: assessment.incidentId,
    assessmentId: assessment.id,
    engineVersion: assessment.engineVersion,
    methodologyVersion: assessment.methodologyVersion,
    integrityRisk: assessment.integrityRisk,
    evidenceConfidence: assessment.evidenceConfidence,
    inputEvidenceIds: [...assessment.inputEvidenceIds].sort(),
    boundaryId: assessment.boundaryId,
    timestamp: assessment.createdAt.toISOString(),
    eventType,
  };
}

export function serializeCanonicalEvidence(
  assessment: CanonicalAssessment,
  eventType: AnchorEventType,
): string {
  return stableStringify(buildCanonicalEvidenceRecord(assessment, eventType));
}

export function hashCanonicalEvidence(
  assessment: CanonicalAssessment,
  eventType: AnchorEventType,
): Hex {
  return keccak256(toBytes(serializeCanonicalEvidence(assessment, eventType)));
}

function sanitizedFailureReason(error: unknown): string {
  if (error instanceof Error && error.name) {
    return `Blockchain submission failed (${error.name})`;
  }
  return "Blockchain submission failed";
}

function readConfig(options: BlockchainServiceOptions): AnchorConfig | null {
  const address = options.contractAddress ?? process.env.BLOCKCHAIN_CONTRACT_ADDRESS;
  if (!isContractAddress(address)) return null;
  return {
    contractAddress: address,
    network: options.network ?? process.env.BLOCKCHAIN_NETWORK ?? "sepolia",
  };
}

function createViemTransport(config: AnchorConfig): AnchorTransport | null {
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
  const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
  if (!rpcUrl || !/^https?:\/\//.test(rpcUrl) || !/^0x[0-9a-fA-F]{64}$/.test(privateKey ?? "")) {
    return null;
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });
  return {
    async submit(input) {
      return walletClient.writeContract({
        chain: sepolia,
        address: config.contractAddress,
        abi: CARBONX_ANCHOR_ABI,
        functionName: "anchor",
        args: [input.incidentIdHash, input.evidenceHash, input.eventType],
      });
    },
    async waitForConfirmation(txHash) {
      const confirmations = Math.max(
        1,
        Number(process.env.BLOCKCHAIN_CONFIRMATIONS ?? "1"),
      );
      await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations });
      return new Date();
    },
  };
}

export class BlockchainService {
  constructor(
    private readonly db: DatabaseClient = prisma,
    private readonly options: BlockchainServiceOptions = {},
  ) {}

  async anchorIncidentTransition(
    incidentId: string,
    eventType: AnchorEventType,
  ): Promise<AnchorResult | null> {
    const assessment = await this.db.riskAssessment.findFirst({
      where: { incidentId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        incidentId: true,
        engineVersion: true,
        methodologyVersion: true,
        integrityRisk: true,
        evidenceConfidence: true,
        inputEvidenceIds: true,
        boundaryId: true,
        createdAt: true,
      },
    });
    if (!assessment) return null;
    return this.anchorAssessment(assessment, eventType);
  }

  async anchorAssessment(
    assessment: CanonicalAssessment,
    eventType: AnchorEventType,
  ): Promise<AnchorResult> {
    assertAnchorEventType(eventType);
    const config = readConfig(this.options);
    const hash = hashCanonicalEvidence(assessment, eventType);
    const existing = await this.db.blockchainAnchor.findUnique({
      where: {
        assessmentId_eventType: {
          assessmentId: assessment.id,
          eventType,
        },
      },
    });

    if (existing && (existing.status === AnchorStatus.CONFIRMED || existing.status === AnchorStatus.SUBMITTED)) {
      return {
        anchorId: existing.id,
        status: existing.status,
        hash: existing.hash as Hex,
        txHash: (existing.txHash as Hex | null) ?? null,
        eventType,
        failureReason: existing.failureReason,
      };
    }

    if (!config) {
      return this.persistFailure(
        assessment,
        eventType,
        hash,
        existing?.id ?? null,
        "Blockchain configuration unavailable",
      );
    }

    const anchor = existing
      ? await this.db.blockchainAnchor.update({
          where: { id: existing.id },
          data: {
            status: AnchorStatus.PENDING,
            canonicalJson: buildCanonicalEvidenceRecord(assessment, eventType),
            hash,
            network: config.network,
            contractAddress: config.contractAddress,
            failureReason: null,
          },
        })
      : await this.db.blockchainAnchor.create({
          data: {
            incidentId: assessment.incidentId,
            assessmentId: assessment.id,
            canonicalJson: buildCanonicalEvidenceRecord(assessment, eventType),
            hash,
            network: config.network,
            contractAddress: config.contractAddress,
            eventType,
            status: AnchorStatus.PENDING,
          },
        });

    const transport = this.options.transport ?? createViemTransport(config);
    if (!transport) {
      return this.persistFailure(
        assessment,
        eventType,
        hash,
        anchor.id,
        "Blockchain configuration unavailable",
      );
    }

    try {
      const txHash = await transport.submit({
        incidentIdHash: keccak256(toBytes(assessment.incidentId)),
        evidenceHash: hash,
        eventType,
      });
      await this.db.blockchainAnchor.update({
        where: { id: anchor.id },
        data: { status: AnchorStatus.SUBMITTED, txHash },
      });

      if (transport.waitForConfirmation) {
        const confirmedAt = await transport.waitForConfirmation(txHash);
        const confirmed = await this.db.blockchainAnchor.update({
          where: { id: anchor.id },
          data: { status: AnchorStatus.CONFIRMED, confirmedAt },
        });
        return {
          anchorId: confirmed.id,
          status: confirmed.status,
          hash,
          txHash,
          eventType,
          failureReason: null,
        };
      }

      return {
        anchorId: anchor.id,
        status: AnchorStatus.SUBMITTED,
        hash,
        txHash,
        eventType,
        failureReason: null,
      };
    } catch (error) {
      return this.persistFailure(
        assessment,
        eventType,
        hash,
        anchor.id,
        sanitizedFailureReason(error),
      );
    }
  }

  private async persistFailure(
    assessment: CanonicalAssessment,
    eventType: AnchorEventType,
    hash: Hex,
    existingId: string | null,
    reason: string,
  ): Promise<AnchorResult> {
    const config = readConfig(this.options);
    const contractAddress = config?.contractAddress ?? "UNCONFIGURED";
    const network = config?.network ?? process.env.BLOCKCHAIN_NETWORK ?? "sepolia";
    const anchor = existingId
      ? await this.db.blockchainAnchor.update({
          where: { id: existingId },
          data: {
            status: AnchorStatus.FAILED,
            canonicalJson: buildCanonicalEvidenceRecord(assessment, eventType),
            hash,
            network,
            contractAddress,
            failureReason: reason,
          },
        })
      : await this.db.blockchainAnchor.create({
          data: {
            incidentId: assessment.incidentId,
            assessmentId: assessment.id,
            canonicalJson: buildCanonicalEvidenceRecord(assessment, eventType),
            hash,
            network,
            contractAddress,
            eventType,
            status: AnchorStatus.FAILED,
            failureReason: reason,
          },
        });
    return {
      anchorId: anchor.id,
      status: anchor.status,
      hash,
      txHash: (anchor.txHash as Hex | null) ?? null,
      eventType,
      failureReason: anchor.failureReason,
    };
  }
}

export const blockchainService = new BlockchainService();
