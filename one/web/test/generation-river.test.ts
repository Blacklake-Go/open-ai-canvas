import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  changedRiverTasks,
  recordRiverActivity,
  restoreHomeCreation,
  type RiverTask,
} from '../src/services/api/generation-river';

function task(id: string, status: RiverTask['status']): RiverTask {
  return { id, requestId: id, status, mode: 'image', createdAt: '2026-11-24T00:00:00Z' };
}

test('same refresh records every transition and delayed progress does not replace a final notice', () => {
  const before = [task('image', 'queued'), task('music', 'running')];
  const after = [task('image', 'failed'), task('music', 'succeeded')];
  const activity = recordRiverActivity([], changedRiverTasks(before, after), 100);
  assert.deepEqual(activity.map(item => [item.id, item.status]), [
    ['image', 'failed'],
    ['music', 'succeeded'],
  ]);
  assert.equal(recordRiverActivity(activity, [task('music', 'running')], 110), activity);
  assert.equal(recordRiverActivity(activity, [task('music', 'succeeded')], 120), activity);
});

test('home recovery accepts owned asset references and restores the recorded mode', () => {
  const created_at = '2026-11-24T00:00:00Z';
  assert.deepEqual(restoreHomeCreation({
    id: 'avatar-failed', studio_id: 'home-digital-human', status: 'failed', created_at,
    input_summary_json: { image_url: 'koyo-asset:portrait', audio_url: 'https://untrusted.test/voice.wav', prompt: 'animate' },
  }), {
    mode: 'digital-human',
    fields: { prompt: 'animate', driveType: 'audio', avatarKind: 'image', avatarUrl: '/api/assets/portrait/download?inline=1', driveAudioUrl: null },
  });
  assert.deepEqual(restoreHomeCreation({
    id: 'speech-done', studio_id: 'home-avatar-speech', status: 'succeeded', created_at, asset_id: 'spoken',
  }), {
    mode: 'digital-human',
    fields: { prompt: '', driveType: 'audio', driveAudioUrl: '/api/assets/spoken/download?inline=1' },
  });
});

test("multi-output extraction preserves all decomposed layers in river task outputs", () => {
  const { fromServer } = require("../src/services/api/generation-river");
  const { completedGeneration } = require("../src/packages/studio/src/platformGeneration");

  const mockCreation = {
    id: "gen-layers-123",
    studio_id: "layers",
    status: "succeeded",
    created_at: "2026-11-24T00:00:00Z",
    result_url: "https://storage.test/layer-1.png",
    metadata_json: JSON.stringify({
      outputs: [
        "https://storage.test/layer-1.png",
        "https://storage.test/layer-2.png",
        "https://storage.test/layer-3.png"
      ]
    })
  };

  const completed = completedGeneration(mockCreation, mockCreation.id);
  assert.equal(completed.status, "completed");
  assert.equal(completed.outputs.length, 3);
  assert.deepEqual(completed.outputs, [
    "https://storage.test/layer-1.png",
    "https://storage.test/layer-2.png",
    "https://storage.test/layer-3.png"
  ]);

  const riverTask = fromServer(mockCreation);
  assert.equal(riverTask.status, "succeeded");
  assert.equal(riverTask.outputs?.length, 3);
  assert.deepEqual(riverTask.outputs, [
    "https://storage.test/layer-1.png",
    "https://storage.test/layer-2.png",
    "https://storage.test/layer-3.png"
  ]);
});
