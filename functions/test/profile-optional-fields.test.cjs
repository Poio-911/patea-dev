const {test}=require('node:test');
const assert=require('node:assert/strict');
const {optionalProfileFields}=require('../lib/lib/profile-optional-fields');
test('campos omitidos conservan datos existentes',()=>assert.deepEqual(optionalProfileFields({}),{}));
test('null explícito borra año y pie hábil',()=>assert.deepEqual(optionalProfileFields({birthYear:null,preferredFoot:null}),{birthYear:null,preferredFoot:null}));
test('normaliza pie y año válido',()=>assert.deepEqual(optionalProfileFields({birthYear:'1995',preferredFoot:'IZQUIERDO'},2026),{birthYear:1995,preferredFoot:'izquierdo'}));
test('mantiene límites de edad y opciones admitidas',()=>{
  for(const birthYear of [1949,2022,1995.5,'texto']) assert.throws(()=>optionalProfileFields({birthYear},2026),{code:'invalid-argument'});
  assert.throws(()=>optionalProfileFields({preferredFoot:'otro'}),{code:'invalid-argument'});
});
