import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorkspace, validateWorkspace, validateBackup, parseTags, belongsToProject } from '../src/services/workspaceModel.ts';
import { localDateKey } from '../src/services/localDate.ts';

test('dangling project references and duplicate IDs cannot enter storage', () => {
  const w = emptyWorkspace();
  w.projects.push({ id: 'project', name: 'Website', clientId: 'missing' });
  assert.throws(() => validateWorkspace(w), /reference/);
  w.clients.push({ id: 'project', name: 'Client' });
  assert.throws(() => validateWorkspace(w), /duplicate/);
});
test('Arabic tags are normalized and duplicates removed', () => {
  assert.deepEqual(parseTags('#عقد، تصميم, عقد,, #urgent'), ['عقد','تصميم','urgent']);
  assert.throws(() => parseTags('x'.repeat(241)));
});
test('damaged backups cannot silently drop or substitute attachment bytes', () => {
  const workspace = emptyWorkspace();
  workspace.attachments.push({ id:'file', name:'contract.txt', mimeType:'text/plain', size:3, tags:[], createdAt:'2026-10-18' });
  const backup = {format:'smart-time-workspace',version:1,workspace,files:[]};
  assert.throws(() => validateBackup(backup), /missing/);
  backup.files = [{id:'file',bytes:[1,2,3]}];
  assert.equal(validateBackup(backup).files[0].bytes[2],3);
  backup.files[0].bytes[2] = 256;
  assert.throws(() => validateBackup(backup), /bytes/);
});
test('client filters cannot include a different client’s project', () => {
  const w = emptyWorkspace();
  w.clients = [{id:'a',name:'A'},{id:'b',name:'B'}];
  w.projects = [{id:'pa',name:'Website',clientId:'a'},{id:'pb',name:'App',clientId:'b'}];
  assert.equal(belongsToProject(w,'pa','a',''),true);
  assert.equal(belongsToProject(w,'pb','a',''),false);
  assert.equal(belongsToProject(w,null,'a',''),false);
});
test('bad legacy data is rejected rather than replaced with an empty workspace', () => {
  assert.throws(() => emptyWorkspace([{id:'bad',title:'Missing content'}],[]));
  assert.throws(() => validateWorkspace({...emptyWorkspace(),schemaVersion:2}));
});
test('task dates use the local calendar day around midnight', () => {
  assert.equal(localDateKey(new Date(2026, 9, 18, 0, 1)), '2026-10-18');
  assert.equal(localDateKey(new Date(2026, 0, 2, 23, 59)), '2026-01-02');
});
