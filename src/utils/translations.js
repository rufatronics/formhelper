// src/utils/translations.js
// Plain-language translations and navigation strings for multi-language navigation.
// Supported languages: English, Hausa (Arewacin Najeriya), Nigerian Pidgin (Pidgin English).

export const LANGUAGES = [
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'ha', label: 'Hausa', flag: '🇳🇬' },
  { id: 'pcm', label: 'Pidgin', flag: '🗣️' }
];

export const TRANSLATIONS = {
  en: {
    title: 'ClearForm',
    subTitle: 'Powered by Gemma 4',
    form: 'Fill Form',
    compare: 'Compare Docs',
    chat: 'Ask Questions',
    verify: 'Verify Doc',
    scam: 'Scam Check',

    // Verify View Strings
    verifyTitle: 'Verify Document',
    verifyDesc: 'Upload a certificate, admission letter, or ID to analyze if it is genuine, digitally modified, or AI-generated.',
    verifyUploader: 'Select or take a photo of the document',
    verifyAnalysisBtn: 'Analyze Forensics with Gemma 4 →',
    verifyResultsTitle: 'Verification Report',
    verifyStartNew: '← Start New',
    verifyClassification: 'Classification',
    verifyConfidence: 'Confidence Score',
    verifyHeatmapTitle: 'Error Level Analysis Heatmap',
    verifyHeatmapDesc: 'Heatmap shows local compression differences. High-contrast edge highlights are normal, but localized bright grids/spots often point to digital modifications.',
    verifySignalsTitle: 'Detailed Signals Analysis',
    verifyProcessingTitle: 'Document Forensics',
    verifyProcessingDesc: 'Analyzing image pixels...',

    // Scam Check View Strings
    scamTitle: 'Scam Check',
    scamDesc: 'Paste a job offer, loan deal, award message, or SMS to check if it displays red flags or leads to lookalike phishing domains.',
    scamPlaceholder: 'Paste or record the message here…',
    scamBtn: 'Evaluate Scam Risk with Gemma 4 →',
    scamResultsTitle: 'Scam Check Report',
    scamRisk: 'Risk Level',
    scamIndicators: 'Text Indicators',
    scamLinks: 'Extracted Link Findings',
    scamNoLinks: 'No links extracted from the message.',
    scamProcessingTitle: 'Scanning Message...',
    scamProcessingDesc: 'Analyzing TLDs, shorteners, and linguistic indicators...'
  },
  ha: {
    title: 'ClearForm',
    subTitle: 'Gemma 4 ce ke tace shi',
    form: 'Cika Form',
    compare: 'Kwatanta Docs',
    chat: 'Tambayi AI',
    verify: 'Tantance Doc',
    scam: 'Gane Algush',

    // Verify View Strings
    verifyTitle: 'Tantance Takarda',
    verifyDesc: 'Saka hoton takardar shaidar karatu, wasikar shiga makaranta, ko katin shaida don bincika ko na gaske ne ko an canza shi ko kuma AI ne ya samar da shi.',
    verifyUploader: 'Zabi ko dauki hoton takarda',
    verifyAnalysisBtn: 'Bincika da Gemma 4 →',
    verifyResultsTitle: 'Sakamakon Tantancewa',
    verifyStartNew: '← Sake Sabo',
    verifyClassification: 'Rukuni',
    verifyConfidence: 'Matakin Amincewa',
    verifyHeatmapTitle: 'Taswirar Bambancin Matsi (ELA)',
    verifyHeatmapDesc: 'Taswirar tana nuna bambancin matsi na JPEG. Wurare masu haske a gefe na da kyau, amma haske a tsakiya na nufin an taba hoton ta hanyar naura.',
    verifySignalsTitle: 'Cikakken Binciken Alamomi',
    verifyProcessingTitle: 'Ana Binciken Takarda...',
    verifyProcessingDesc: 'Ana duba pixel na hoton takarda...',

    // Scam Check View Strings
    scamTitle: 'Gane Algush ko Tsari',
    scamDesc: 'Saka tallan aiki, lamuni, sako na kyauta, ko SMS don duba ko akwai alamun damfara ko kuma shafukan sata na yanar gizo.',
    scamPlaceholder: 'Saka ko rikodin sakon anan...',
    scamBtn: 'Gano Hadari da Gemma 4 →',
    scamResultsTitle: 'Sakamakon Binciken Damfara',
    scamRisk: 'Matakin Hadari',
    scamIndicators: 'Alamun Rubutu',
    scamLinks: 'Binciken Hanyoyin Sadarwa (Links)',
    scamNoLinks: 'Babu wasu links da aka samu a cikin sakon.',
    scamProcessingTitle: 'Ana Bincika Sakon Rubutu...',
    scamProcessingDesc: 'Ana duba shafukan yanar gizo da alamun rubutu...'
  },
  pcm: {
    title: 'ClearForm',
    subTitle: 'Gemma 4 dey run am',
    form: 'Fill Form',
    compare: 'Compare Docs',
    chat: 'Ask AI',
    verify: 'Check Doc',
    scam: 'Scam Check',

    // Verify View Strings
    verifyTitle: 'Check If Document Real',
    verifyDesc: 'Upload school certificate, admission letter, or ID card to check if na original, if person don edit am, or if AI make am from scratch.',
    verifyUploader: 'Select file or snap photo of document',
    verifyAnalysisBtn: 'Check Forensics with Gemma 4 →',
    verifyResultsTitle: 'Document Realness Report',
    verifyStartNew: '← Start New One',
    verifyClassification: 'Wetin We Find',
    verifyConfidence: 'Trust Level',
    verifyHeatmapTitle: 'ELA Heatmap (Compression Check)',
    verifyHeatmapDesc: 'This map dey show compression settings. Normal borders fit bright, but if central spaces dey shine, e fit mean say somebody don change the picture inside computer.',
    verifySignalsTitle: 'Full Signals Breakdown',
    verifyProcessingTitle: 'Forensics dey Run...',
    verifyProcessingDesc: 'We dey check the image pixel design...',

    // Scam Check View Strings
    scamTitle: 'Scam Check',
    scamDesc: 'Paste job advertisement, loan offer, cash award, or SMS to verify if na wayo/scam or if the link dem be fake phishing site.',
    scamPlaceholder: 'Paste message or record voice here…',
    scamBtn: 'Check Scam Risk with Gemma 4 →',
    scamResultsTitle: 'Scam Report Details',
    scamRisk: 'Risk Level',
    scamIndicators: 'Linguistic Wayo Signs',
    scamLinks: 'Links Wey Dey Inside',
    scamNoLinks: 'No link dey inside this message.',
    scamProcessingTitle: 'Checking your message...',
    scamProcessingDesc: 'We dey analyze domain extensions and bad words...'
  }
};
