// prompts.js — All Gemma 4 prompt templates
// Gemma 4 supports a native system role — we use it properly here.

export const SYSTEM_PROMPTS = {
  formHelper: `You are ClearForm, a helpful assistant that guides people with low literacy 
through filling out official forms. Always use simple words a 10-year-old would understand. 
Ask one question at a time. Be warm and encouraging. Never use jargon. 
If someone makes an error, gently explain what's needed. Respond concisely.`,

  tcCompare: `You are ClearForm, an assistant that explains legal documents in plain language. 
Translate complex legal text into words a 3rd-grader would understand. 
Focus on: what it costs, what you can and cannot do, how to cancel, and any penalties. 
Be honest, neutral, and never give legal advice. Respond concisely.`,

  chat: `You are ClearForm, a friendly assistant helping people understand their forms and documents. 
Use simple, clear language. Be patient and supportive. 
If asked about legal, medical, or financial decisions, remind the user to consult a professional.`
}

// Form field extraction — uses Gemma 4 JSON mode
export function buildFieldExtractionPrompt(documentText) {
  return {
    systemPrompt: SYSTEM_PROMPTS.formHelper,
    userPrompt: `Look at this form and find all the blank fields that need to be filled in.

Return ONLY valid JSON — no explanation, no markdown, no backticks.

JSON format:
{
  "formTitle": "name of the form",
  "fields": [
    {
      "id": "unique_id",
      "label": "exact label text from form",
      "type": "text|email|phone|date|number|checkbox|radio|textarea|name|address",
      "required": true or false,
      "placeholder": "example of what to write",
      "helpText": "one plain-English sentence explaining what this field is for"
    }
  ]
}

Form content:
${documentText}`
  }
}

// Ask a single form question conversationally
export function buildFormQuestionPrompt(field, previousAnswers) {
  const context = previousAnswers.length > 0
    ? `So far they have answered:\n${previousAnswers.map(a => `- ${a.label}: ${a.value}`).join('\n')}\n\n`
    : ''

  return {
    systemPrompt: SYSTEM_PROMPTS.formHelper,
    userPrompt: `${context}Now ask the user to fill in this field in a warm, conversational way:

Field: "${field.label}"
Type: ${field.type}
Required: ${field.required ? 'yes' : 'no'}
Help: ${field.helpText || ''}

Write a single short question (1-2 sentences). If it's a phone or email field, 
give a clear example. Do not repeat the field label robotically.`
  }
}

// Validate a field answer
export function buildValidationPrompt(field, userAnswer) {
  return {
    systemPrompt: SYSTEM_PROMPTS.formHelper,
    userPrompt: `The user answered "${userAnswer}" for the field "${field.label}" (type: ${field.type}).

Is this a valid answer? Return ONLY valid JSON:
{
  "valid": true or false,
  "normalizedValue": "cleaned up version of their answer",
  "errorMessage": "friendly explanation if invalid, empty string if valid"
}`
  }
}

// T&C simplification — uses thinking mode for better analysis
export function buildSimplifyPrompt(legalText) {
  return {
    systemPrompt: SYSTEM_PROMPTS.tcCompare,
    userPrompt: `Rewrite this legal text so a 10-year-old can understand it.
Use short sentences. Use everyday words. Keep ALL important facts (costs, deadlines, penalties, cancellation).
Group into these sections: "What this is", "What it costs", "What you can do", "What you cannot do", "How to cancel", "Watch out for".
Skip any section that doesn't apply.

Legal text:
${legalText}`
  }
}

// T&C comparison — uses thinking mode, returns structured JSON
export function buildComparePrompt(textA, textB, labelA = 'Document A', labelB = 'Document B') {
  return {
    systemPrompt: SYSTEM_PROMPTS.tcCompare,
    useThinking: true,
    userPrompt: `Compare these two documents and find the key differences that affect a regular person.

Return ONLY valid JSON — no explanation, no markdown, no backticks:
{
  "summary": "2 sentence plain-English overall summary of the main difference",
  "recommendation": "one clear sentence about which is more user-friendly and why, or 'They are equally good/bad'",
  "differences": [
    {
      "topic": "plain English topic name (e.g. Cost, Cancellation, Privacy)",
      "docA": "what Document A says in plain English",
      "docB": "what Document B says in plain English",
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

// Explain a specific clause
export function buildExplainClausePrompt(clause, context = '') {
  return {
    systemPrompt: SYSTEM_PROMPTS.tcCompare,
    userPrompt: `Explain this part of a document in very simple words:

"${clause}"

${context ? `Context: ${context}\n` : ''}
Write 2-3 short sentences. Use words a 10-year-old would know. 
Focus on what this means for the person who signed it.`
  }
}

// General chat
export function buildChatPrompt(userMessage, history = [], documentContext = '') {
  return {
    systemPrompt: SYSTEM_PROMPTS.chat,
    userPrompt: userMessage,
    history,
    documentContext
  }
}
