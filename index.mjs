import { execFile } from 'node:child_process';
import { check, error, text, verdict, z } from '@cairul/pdk';

const outputSchema = z.object({ summary: z.object({ deployable: z.boolean().nullable() }) });

export default function pact(options) {
  const { executable } = z.strictObject({ executable: text.default('pact-broker') }).parse(options);
  return {
    checkKinds: {
      'pact.can-deploy': check(
        z.strictObject({ pacticipant: text, version: text, environment: text }),
        ({ pacticipant, version, environment }, { projectDir, signal }) =>
          new Promise((resolve) => {
            const args = [
              'can-i-deploy',
              '--pacticipant',
              pacticipant,
              '--version',
              version,
              '--to-environment',
              environment,
              '--output',
              'json',
            ];
            execFile(executable, args, { cwd: projectDir, signal, maxBuffer: 2 * 1024 * 1024 }, (cause, stdout) => {
              if (signal.aborted || !stdout) {
                resolve(error('Pact Broker command did not return a result.'));
                return;
              }
              try {
                const { deployable } = outputSchema.parse(JSON.parse(stdout)).summary;
                if (cause && deployable === true) throw new Error('Pact Broker exited unsuccessfully.');
                resolve(
                  verdict(
                    deployable === true,
                    deployable ? 'Contract compatibility confirmed.' : 'Waiting for contract compatibility.'
                  )
                );
              } catch {
                resolve(error('Pact Broker command returned an invalid result.'));
              }
            });
          })
      ),
    },
  };
}
