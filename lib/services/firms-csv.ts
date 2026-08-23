export type FirmsCsvRecord = Record<string, string>;

function pushCsvField(fields: string[], field: string) {
  fields.push(field);
}

/** Parse the RFC 4180-style CSV returned by NASA FIRMS without a new dependency. */
export function parseFirmsCsv(csv: string): FirmsCsvRecord[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && character === ",") {
      pushCsvField(row, field);
      field = "";
      continue;
    }
    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      pushCsvField(row, field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += character;
  }

  if (quoted) throw new Error("NASA FIRMS CSV contains an unterminated quoted field");
  if (field !== "" || row.length > 0) {
    pushCsvField(row, field);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows.shift()!.map((header, index) =>
    (index === 0 ? header.replace(/^\uFEFF/, "") : header).trim(),
  );
  if (headers.some((header) => header.length === 0) || new Set(headers).size !== headers.length) {
    throw new Error("NASA FIRMS CSV has invalid or duplicate headers");
  }

  const requiredHeaders = [
    "latitude",
    "longitude",
    "acq_date",
    "acq_time",
    "instrument",
  ];
  if (requiredHeaders.some((header) => !headers.includes(header))) {
    throw new Error("NASA FIRMS CSV is missing required observation columns");
  }

  return rows.map((values) => {
    if (values.length !== headers.length) {
      throw new Error("NASA FIRMS CSV row does not match its header length");
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index].trim()]));
  });
}
