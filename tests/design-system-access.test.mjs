import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";

test("design-system denies production requests before session refresh and retains development previews",async()=>{
  const source=readFileSync(new URL("../proxy.ts",import.meta.url),"utf8");
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  for(const env of ["production","development"]){
    let sessions=0;
    const context={exports:{},Response,process:{env:{NODE_ENV:env,MAINTENANCE_MODE:"false"}},require:name=>{
      if(name==="next/server")return{NextResponse:{next:()=>({passed:true})}};
      assert.equal(name,"@/utils/supabase/proxy");return{updateSession:()=>{sessions++;return{passed:true};}};
    }};
    vm.runInNewContext(code,context);
    for(const pathname of ["/design-system","/design-system/","/design-system/future-preview/nested"]){
      const response=await context.exports.proxy({nextUrl:{pathname}});
      if(env==="production"){assert.equal(response.status,404);assert.equal(sessions,0);}
      else assert.equal(response.passed,true);
    }
    for(const pathname of ["/connexion","/design-system-other"]){
      assert.equal((await context.exports.proxy({nextUrl:{pathname}})).passed,true);
    }
  }
});
