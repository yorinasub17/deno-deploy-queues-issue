import * as oak from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { crypto } from "https://deno.land/std@0.202.0/crypto/mod.ts";

// Open KV
const kv = await Deno.openKv();
kv.listenQueue(async (msg: { requestID: string }): Promise<void> => {
  await kv.set([msg.requestID], true);
});

const app = new oak.Application();
app.use(async (ctx: oak.Context) => {
  const requestID = getRandomString(6);
  await kv.enqueue({
    requestID: requestID,
  });
  if (await waitForHealthCheckResult(requestID)) {
    ctx.response.status = 204;
  } else {
    ctx.response.status = 500;
  }
});
await app.listen();

async function waitForHealthCheckResult(
  reqID: string,
): Promise<boolean> {
  const maxTries = 30;
  const sleepBetweenTries = 2;

  for (let i = 0; i < maxTries; i++) {
    const result = await kv.get([reqID]);
    if (result.value) {
      return true;
    }

    if (i < maxTries - 1) {
      console.debug(
        `Health check result not ready (try ${
          i + 1
        } of ${maxTries}). Retrying after sleep for ${sleepBetweenTries} seconds.`,
      );
      await sleep(sleepBetweenTries * 1000);
    }
  }

  console.error("Timed out waiting for healthcheck result");
  return false;
}

function getRandomString(s: number) {
  if (s % 2 == 1) {
    throw new Deno.errors.InvalidData("Only even sizes are supported");
  }
  const buf = new Uint8Array(s / 2);
  crypto.getRandomValues(buf);
  let ret = "";
  for (let i = 0; i < buf.length; ++i) {
    ret += ("0" + buf[i].toString(16)).slice(-2);
  }
  return ret;
}

function sleep(time: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, time));
}
