import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import test from 'node:test';

test('C4: AGY docs must not contain rejected sandbox or command contracts', () => {
    const agyUsagePath = path.join(process.cwd(), 'docs', 'AGY_USAGE.md');
    const pipelinePath = path.join(process.cwd(), 'SSTAC_AI_PIPELINE.md');

    assert.ok(fs.existsSync(agyUsagePath), 'AGY_USAGE.md must exist');
    assert.ok(fs.existsSync(pipelinePath), 'SSTAC_AI_PIPELINE.md must exist');

    const agyUsage = fs.readFileSync(agyUsagePath, 'utf8');
    const pipeline = fs.readFileSync(pipelinePath, 'utf8');

    // Negative checks
    assert.ok(!agyUsage.includes('--sandbox=false'), 'AGY_USAGE.md must not prescribe --sandbox=false');
    assert.ok(!pipeline.includes('--sandbox=false'), 'SSTAC_AI_PIPELINE.md must not prescribe --sandbox=false');
    assert.ok(!agyUsage.includes('optional exact commands'), 'AGY_USAGE.md must not prescribe optional exact commands');

    // Positive checks
    assert.ok(agyUsage.includes('--sandbox'), 'AGY_USAGE.md must prescribe affirmative standalone --sandbox');
    assert.ok(pipeline.includes('--sandbox'), 'SSTAC_AI_PIPELINE.md must prescribe affirmative standalone --sandbox');
    assert.ok(agyUsage.includes('rejection of every nonempty'), 'AGY_USAGE.md must prescribe rejection of nonempty AllowedCommands input');
    assert.ok(agyUsage.includes('Command execution is disabled in the production controller'), 'AGY_USAGE.md must state command execution is disabled in production controller');
    assert.ok(pipeline.includes('rejects every nonempty `AllowedCommands` input'), 'SSTAC_AI_PIPELINE.md must state rejection of nonempty AllowedCommands input');
    assert.ok(pipeline.includes('command execution remains disabled until a separately accepted real sandbox canary'), 'SSTAC_AI_PIPELINE.md must state command execution remains disabled');
});
