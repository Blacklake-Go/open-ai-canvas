import { stdin, stdout } from "node:process";
import { handleRPC } from "./waffo";

const maxBytes = 2 << 20;
async function main() {
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of stdin) {
      size += chunk.length;
      if (size > maxBytes) throw new Error("Request too large");
      chunks.push(chunk);
    }
    const response = await handleRPC(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    stdout.write(JSON.stringify(response) + "\n");
  } catch {
    stdout.write('{"ok":false,"code":"invalid_request","message":"Invalid payment RPC request"}\n');
  }
}

void main();
