import { readChunks } from "./repo";

export async function readChunk(chunkIds: number[]) {
  return readChunks(chunkIds);
}
