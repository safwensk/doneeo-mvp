import test from "node:test";
import assert from "node:assert/strict";
import type { PlannerAnalysis, JobIntelligence } from "../lib/planner";
import type { RequirementContract, TaskBlockLifecycleIdentity } from "../lib/requirement-contract";
import type { TaskIdentity } from "../lib/intelligence-task-identity";
import type { WorkCaseControlState } from "../lib/work-case";
import { RequirementContractService } from "../lib/application/requirement-contract-service";
import type { AtomicPublishWrite, AtomicSupersedeWrite, RequirementContractStore, StoredCommand } from "../lib/application/requirement-contract-store";
import { WorkCaseService } from "../lib/application/work-case-service";
import type { WorkCaseEvent, WorkCaseStore } from "../lib/application/work-case-store";
import { IntelligenceControlService } from "../lib/application/intelligence-control-service";

class RcStore implements RequirementContractStore {
  contracts=new Map<string,RequirementContract>(); lifecycle=new Map<string,TaskBlockLifecycleIdentity[]>();commands=new Map<string,StoredCommand>();
  key(id:string,v:number){return `${id}@${v}`;} async getCurrent(id:string){return [...this.contracts.values()].find(c=>c.contractId===id&&c.status==='PUBLISHED')??null;} async getVersion(id:string,v:number){return this.contracts.get(this.key(id,v))??null;} async getLifecycle(id:string,v:number){return (this.lifecycle.get(this.key(id,v))||[]).map(x=>({...x}));} async getCommand(k:string){return this.commands.get(k)??null;}
  async publishAtomic(w:AtomicPublishWrite){if([...this.contracts.values()].some(c=>c.contractId===w.contract.contractId&&c.status==='PUBLISHED'))throw new Error('current version exists');this.contracts.set(this.key(w.contract.contractId,w.contract.version),w.contract);this.lifecycle.set(this.key(w.contract.contractId,w.contract.version),w.lifecycle.map(x=>({...x})));this.commands.set(w.command.commandKey,w.command);}
  async supersedeAtomic(w:AtomicSupersedeWrite){this.contracts.set(this.key(w.previous.contractId,w.previous.version),w.previous);this.contracts.set(this.key(w.next.contractId,w.next.version),w.next);this.lifecycle.set(this.key(w.next.contractId,w.next.version),w.lifecycle.map(x=>({...x})));this.commands.set(w.command.commandKey,w.command);}
}
class WcStore implements WorkCaseStore {
  cases=new Map<string,WorkCaseControlState>();requests=new Map<string,string>();tasks=new Map<string,TaskIdentity[]>();commands=new Map<string,StoredCommand>();
  async get(id:string){return this.cases.get(id)??null;}async getRawRequest(id:string){return this.requests.get(id)??null;}async getTasks(id:string){return (this.tasks.get(id)||[]).map(x=>({...x}));}async getCommand(k:string){return this.commands.get(k)??null;}
  async receiveAtomic(i:{workCase:WorkCaseControlState;rawRequest:string;command:StoredCommand;event:WorkCaseEvent}){this.cases.set(i.workCase.workCaseId,i.workCase);this.requests.set(i.workCase.workCaseId,i.rawRequest);this.commands.set(i.command.commandKey,i.command);}
  async saveArchitectureAtomic(i:{previous:WorkCaseControlState;next:WorkCaseControlState;tasks:readonly TaskIdentity[];command:StoredCommand;event:WorkCaseEvent}){this.cases.set(i.next.workCaseId,i.next);this.tasks.set(i.next.workCaseId,i.tasks.map(x=>({...x})));this.commands.set(i.command.commandKey,i.command);}
  async markRequirementReadyAtomic(i:{previous:WorkCaseControlState;next:WorkCaseControlState;command:StoredCommand;event:WorkCaseEvent}){this.cases.set(i.next.workCaseId,i.next);this.commands.set(i.command.commandKey,i.command);}
}
function ids(){let w=0,j=0,t=0;return{newWorkCaseId:()=>`WC-${++w}`,newJobOrderId:()=>`JO-${++j}`,newTaskId:()=>`T-${++t}`};}

function analysis(ready:boolean):PlannerAnalysis{
 const intelligence:JobIntelligence={version:'2.1.0',facts:[{key:'stop_1',label:'Stop 1',value:'123 Main',source:'customer_request',confidence:'confirmed'}],primitives:[{id:'carry',label:'Carry couch',quantity:1,unitMinutes:45,personMinutes:90,parallelizable:true,dependencies:['dolly'],domain:'transport_handling',lowMinutes:35,highMinutes:60,minimumCrew:2,recommendedCrew:2,qualification:'general_helper',locationIndex:0}],resources:[{id:'dolly',name:'Dolly',kind:'equipment',status:'executor_to_verify',resolution:'provider or rental',estimatedCost:0}],workstreams:[{id:'task_1_transport',sequence:1,title:'Carry couch upstairs',domain:'transport_handling',qualification:'general_helper',phaseIds:['carry'],resourceIds:['dolly'],minimumCrew:2,recommendedCrew:2,likelyMinutes:45,rangeLow:35,rangeHigh:60,completionGate:'Couch placed undamaged',serviceGroup:'shared',assignedRole:'handling crew',handoffRequired:false}],fulfillment:{mode:'single_team',singleCustomerOrder:true,rationale:'one team',groups:[]},manpower:{minimum:2,recommended:2,reason:'safe lift',alternatives:[]},estimate:{ready,personMinutes:90,executionMinutes:45,accessMinutes:10,routeMinutes:0,bufferMinutes:15,totalMinutes:70,rangeLow:55,rangeHigh:85,equation:'work+access+buffer',assumptions:[]},confidence:{level:ready?'high':'medium',score:ready?90:60,reason:'test'},unresolved:ready?[]:['Confirm elevator']};
 return {category:'moving',title:'Move couch',summary:'Carry a couch',safetyNote:'safe lift',questions:ready?[]:[{id:'elevator',label:'Elevator?',type:'boolean',required:true}],extractedAnswers:{},tasks:['Carry couch upstairs'],stops:['123 Main'],routeNodes:[{location:'123 Main',actions:['Carry couch upstairs']}],scheduleWindow:{dateLabel:'Tomorrow',arrivalTime:'10:00 AM',arrivalLabel:'Tomorrow at 10:00 AM'},items:['couch'],customerCanHelp:false,equipment:[],recurrence:{recurring:false,frequency:'One-time'},recommendedTeamSize:2,skillRequirements:['Safe lifting'],executionSteps:['Carry couch'],understoodFacts:['Customer cannot help'],estimate:{serviceMinutesPerVisit:45,travelMinutes:0,people:2,recurringVisits:'One-time',materialsSummary:'Dolly'},sourceText:'Carry my couch upstairs. I cannot help.',audit:{status:'deterministic',issues:[],checks:[]},rulesGate:{version:'1',status:ready?'cleared':'needs_information',riskLevel:'standard',providerClass:'general_helper',summary:'test',issues:[],safeguards:['safe lift'],domains:[]},intelligence};
}

const T1='2026-08-18T10:00:00.000Z',T2='2026-08-18T10:01:00.000Z',T3='2026-08-18T10:02:00.000Z';
test('end-to-end backend slice stays ARCHITECTING until requirements are ready, then publishes and points WorkCase to exact contract version',async()=>{
 const wcStore=new WcStore(),rcStore=new RcStore();const workCases=new WorkCaseService(wcStore,ids());const controller=new IntelligenceControlService(workCases,new RequirementContractService(rcStore));
 const received=await workCases.receiveRequest({commandKey:'receive',rawRequest:'Carry my couch upstairs. I cannot help.',correlationId:'corr',now:T1});
 const pending=await controller.acceptAnalysis({workCaseId:received.workCase.workCaseId,expectedWorkCaseVersion:1,analysis:analysis(false),correlationId:'corr',commandKey:'plan-1',now:T2});
 assert.equal(pending.state,'ARCHITECTING');assert.equal(pending.requirementReady,false);assert.equal(await rcStore.getCurrent('JO-1'),null);
 const ready=await controller.acceptAnalysis({workCaseId:'WC-1',expectedWorkCaseVersion:2,analysis:analysis(true),correlationId:'corr',commandKey:'plan-2',now:T3});
 assert.equal(ready.state,'REQUIREMENT_READY');assert.equal(ready.requirementReady,true);assert.equal(ready.requirementContract?.reference,'JO-1@1');assert.equal((await wcStore.get('WC-1'))?.current.requirementContractRef,'JO-1@1');assert.equal((await rcStore.getCurrent('JO-1'))?.taskBlocks[0]?.requirementId,'T-1');
});
