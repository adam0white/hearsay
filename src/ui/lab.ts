/** The game lab client for linked recording and the existing run dialog. */
import { createLab, type Lab } from '@adam0white/lab-client';

export const lab: Lab = createLab({ game: 'hearsay' });

// Keep a legacy history key while startup restores the saved run. Recording follows the lab switch.
lab.setPersonaRecording('pending-history');
