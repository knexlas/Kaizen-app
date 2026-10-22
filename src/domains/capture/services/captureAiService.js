import {
  parseOmniAddInput as parseOmniAddInputFromGemini,
  processIncomingCompost as processIncomingCompostFromGemini,
  draftPlanFromNote as draftPlanFromNoteFromGemini,
} from '../../../services/geminiService';

export async function parseOmniAddInput(userText) {
  return parseOmniAddInputFromGemini(userText);
}

export async function processIncomingCompost(fileOrText) {
  return processIncomingCompostFromGemini(fileOrText);
}

export async function draftPlanFromNote(noteText) {
  return draftPlanFromNoteFromGemini(noteText);
}
