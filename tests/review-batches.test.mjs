import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewBatches} from '../skill/scripts/review-batches.mjs';
const roles=['review_ui','review_performance','review_architecture','review_security','review_docs','review_tests','review_qa'];
test('review modes produce serial, bounded or all-at-once specialist waves',()=>{
 assert.deepEqual(reviewBatches({roles,execution:'sequential'}).batches,roles.map(r=>[r]));
 assert.deepEqual(reviewBatches({roles,execution:'batched',max_parallel:3}).batches,[roles.slice(0,3),roles.slice(3,6),roles.slice(6)]);
 assert.deepEqual(reviewBatches({roles,execution:'parallel',max_parallel:null}).batches,[roles]);
 assert.deepEqual(reviewBatches({roles:[]}).batches,[]);
});
test('invalid modes, capacities, duplicate or dependent critics are refused',()=>{
 for(const input of [{roles,execution:'all'},{roles,execution:'parallel',max_parallel:2},{roles,max_parallel:0},{roles,max_parallel:1.5},{roles:['review_final']},{roles:['review_adversarial']},{roles:['review_qa','review_qa']}]) assert.throws(()=>reviewBatches(input));
});
