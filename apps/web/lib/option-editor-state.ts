/** Retain unsaved edits to *other* rows during a successful save/refresh.
 * Keep their original revision: a concurrent remote edit must still produce 409.
 */
export function preserveDirtyDrafts<T>(
 incoming:Record<string,T>,current:Record<string,T>,dirty:ReadonlySet<string>
):Record<string,T>{
 const merged:Record<string,T>={};
 for(const [id,fresh] of Object.entries(incoming))
  merged[id]=dirty.has(id)&&Object.prototype.hasOwnProperty.call(current,id)?current[id]:fresh;
 return merged;
}
