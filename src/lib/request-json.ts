export class RequestBodyError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
/** Borne aussi les requêtes chunked dont Content-Length est absent ou mensonger. */
export async function readBoundedJson(
  request: Request,
  limit = 4096,
): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > limit)
    throw new RequestBodyError("Requête trop volumineuse.", 413);
  if (!request.body) throw new RequestBodyError("Requête invalide.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new RequestBodyError("Requête trop volumineuse.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    throw new RequestBodyError("Requête invalide.", 400);
  }
}
