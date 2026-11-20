/** Browser-only, pure option selection rules; the API remains the price authority. */
export function selectProductOption(current:readonly string[],optionId:string,checked:boolean,maxSelect:number):string[]{
 if(!optionId||!Number.isInteger(maxSelect)||maxSelect<1||maxSelect>12)return [...current];
 if(!checked)return current.filter(id=>id!==optionId);
 if(current.includes(optionId))return [...current];
 if(maxSelect===1)return [optionId];
 if(current.length>=maxSelect)return [...current];
 return [...current,optionId];
}

/** Cart replacement must follow a distinct, explicit other-restaurant warning. */
export type AddWarning='options'|'restaurant'|null;
export const permitsCartReplacement=(warning:AddWarning):boolean=>warning==='restaurant';

/** A blank form field must not silently become 0 through Number(''). */
export function parseSelectionBound(raw:string,min:number,max:number):number|null{
 if(!/^(0|[1-9][0-9]?)$/.test(raw))return null;
 const n=Number(raw);
 return n>=min&&n<=max?n:null;
}
