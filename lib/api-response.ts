import { NextResponse } from "next/server";

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>({ success: true, data }, { status });
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
) {
  return NextResponse.json<ApiResponse<never>>(
    { success: false, error: { code, message } },
    { status },
  );
}
