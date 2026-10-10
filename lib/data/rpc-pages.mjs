/**
 * @param {(name:string,args?:Record<string,unknown>) => PromiseLike<{data:unknown,error:{code?:string,message?:string}|null}>} rpc
 * @param {string} name
 */
export async function readRpcPages(rpc, name) {
  /** @type {Record<string,unknown>|null} */
  let cursor = null;
  const items = [];
  do {
    const result = await rpc(`${name}_page`, { p_cursor: cursor, p_limit: 100 });
    if (result.error) {
      // Front can ship before its migration. Never hide authorization or later-page errors.
      if (cursor === null && ["PGRST202", "42883"].includes(result.error.code ?? "")) return rpc(name);
      return result;
    }
    const page = /** @type {{items:unknown[],nextCursor:Record<string,unknown>|null}} */ (result.data);
    items.push(...page.items);
    if (page.nextCursor && JSON.stringify(page.nextCursor) === JSON.stringify(cursor)) {
      return { data: null, error: { code: "INVALID_PAGE_CURSOR", message: "Page cursor did not advance" } };
    }
    cursor = page.nextCursor;
  } while (cursor);
  return { data: items, error: null };
}
