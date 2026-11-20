/** Browser-only, pure option selection rules; the API remains the price authority. */
export function selectProductOption(current:readonly string[],optionId:string,checked:boolean,maxSelect:number):string[]{
 if(!optionId||!Number.isInteger(maxSelect)||maxSelect<1||maxSelect>12)return [...current];
 if(!checked)return current.filter(id=>id!==optionId);
 if(current.includes(optionId))return [...current];
 if(maxSelect===1)return [optionId];
 if(current.length>=maxSelect)return [...current];
 return [...current,optionId];
}
