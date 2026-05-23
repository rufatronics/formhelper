// prompts.js — All Gemma 4 prompt templates

export const SYSTEM_PROMPTS = {
  formHelper: `You are ClearForm, a friendly form assistant. 
Reply ONLY with your actual response — no bullet points explaining what you are about to do, no meta-commentary, no "User says", no "Persona", no thinking out loud.
Use simple words. Be warm and brief. One question at a time.`,

  tcCompare: `You are ClearForm, a plain-language document assistant.
Reply ONLY with your actual response — no thinking out loud, no bullet planning, no meta-commentary.
Use simple everyday words. Be clear and concise.`,

  chat: `You are ClearForm, a friendly assistant that helps people understand forms and documents.
Reply ONLY with your actual answer — do not narrate your thought process, do not list what you are about to do, do not use bullet points to plan your response.
Use simple, clear language. Be warm and direct. Keep responses short.`
}

export function buildFieldExtractionPrompt(documentText) {
  return {
    systemPrompt: SYSTEM_PROMPTS.formHelper,
    userPrompt: `Look at this form and find all blank fields that need to be filled in.

Return ONLY valid JSON — no explanation, no markdown, no backticks.

Format:
{
  "formTitle": "name of the form",
  "fields": [
    {
      "id": "unique_id",
      "label": "exact label from form",
      "type": "text|email|phone|date|number|checkbox|radio|textarea|name|address",
      "required": true,
      "placeholder": "example value",
      "helpText": "one plain-English sentence explaining this field"
    }
  ]
}

Form content:
${documentText}`
  }
}

export function buildFormQuestionPrompt(field, previousAnswers) {
  const context = previousAnswers.length > 0
    ? `Already answered: ${previousAnswers.map(a => `${a.label}: ${a.value}`).join(', ')}.\n\n`
    : ''

  return {
    systemPrompt: SYSTEM_PROMPTS.formHelper,
    userPrompt: `${context}Ask the user for their "${field.label}" in one friendly sentence.
${field.type === 'phone' ? 'Give an example like: (555) 123-4567' : ''}
${field.type === 'email' ? 'Give an example like: name@email.com' : ''}
${field.type === 'date' ? 'Give an example like: January 15, 1990' : ''}
${!field.required ? 'Mention they can skip this.' : ''}
Just write the question — nothing else.`
  }
}

export function buildValidationPrompt(field, userAnswer) {
  return {
    systemPrompt: SYSTEM_PROMPTS.formHelper,
    userPrompt: `Is "${userAnswer}" a valid answer for a "${field.label}" field (type: ${field.type})?
Return ONLY valid JSON:
{
  "valid": true,
  "normalizedValue": "cleaned up answer",
  "errorMessage": ""
}`
  }
}

export function buildSimplifyPrompt(legalText) {
  return {
    systemPrompt: SYSTEM_PROMPTS.tcCompare,
    userPrompt: `Rewrite this legal text so a 10-year-old can understand it.
Short sentences. Everyday words. Keep all important facts (costs, deadlines, penalties, cancellation).
Use these sections only where they apply: What this is / What it costs / What you can do / What you cannot do / How to cancel / Watch out for.
Write the simplified version directly — no intro, no preamble.

Legal text:
${legalText}`
  }
}

export function buildComparePrompt(textA, textB, labelA = 'Document A', labelB = 'Document B') {
  return {
    systemPrompt: SYSTEM_PROMPTS.tcCompare,
    useThinking: true,
    userPrompt: `Compare these two documents. Find key differences that affect a regular person.

Return ONLY valid JSON — no explanation, no markdown:
{
  "summary": "2 sentence plain-English summary",
  "recommendation": "one clear sentence about which is more user-friendly and why",
  "differences": [
    {
      "topic": "plain English topic (e.g. Cost, Cancellation, Privacy)",
      "docA": "what ${labelA} says in plain English",
      "docB": "what ${labelB} says in plain English",
      "userNote": "one sentence about what this means for the user"
    }
  ]
}

${labelA}:
${textA}

${labelB}:
${textB}`
  }
}

export function buildExplainClausePrompt(clause, context = '') {
  return {
    systemPrompt: SYSTEM_PROMPTS.tcCompare,
    userPrompt: `Explain this in very simple words that a 10-year-old would understand:

"${clause}"

${context ? `Context: ${context}` : ''}

Write 2-3 short sentences. Just the explanation — no intro, no "This means that".`
  }
}

export function buildChatPrompt(userMessage, history = []) {
  return {
    systemPrompt: SYSTEM_PROMPTS.chat,
    userPrompt: userMessage,
    history
  }
    }
