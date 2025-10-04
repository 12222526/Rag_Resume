import nlp from 'compromise';

// Common PII patterns
const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
  ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
  creditCard: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,
  address: /\d+\s+[A-Za-z0-9\s,.-]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)/gi
};

export function redactPII(text, redactionLevel = 'standard') {
  let redactedText = text;
  const redactions = [];
  
  // Apply different redaction levels
  switch (redactionLevel) {
    case 'minimal':
      // Only redact SSN and credit cards
      redactedText = redactPattern(redactedText, PII_PATTERNS.ssn, '[SSN]', redactions);
      redactedText = redactPattern(redactedText, PII_PATTERNS.creditCard, '[CARD]', redactions);
      break;
      
    case 'standard':
      // Redact email, phone, SSN, credit cards
      redactedText = redactPattern(redactedText, PII_PATTERNS.email, '[EMAIL]', redactions);
      redactedText = redactPattern(redactedText, PII_PATTERNS.phone, '[PHONE]', redactions);
      redactedText = redactPattern(redactedText, PII_PATTERNS.ssn, '[SSN]', redactions);
      redactedText = redactPattern(redactedText, PII_PATTERNS.creditCard, '[CARD]', redactions);
      break;
      
    case 'aggressive':
      // Redact all PII including addresses and names
      redactedText = redactPattern(redactedText, PII_PATTERNS.email, '[EMAIL]', redactions);
      redactedText = redactPattern(redactedText, PII_PATTERNS.phone, '[PHONE]', redactions);
      redactedText = redactPattern(redactedText, PII_PATTERNS.ssn, '[SSN]', redactions);
      redactedText = redactPattern(redactedText, PII_PATTERNS.creditCard, '[CARD]', redactions);
      redactedText = redactPattern(redactedText, PII_PATTERNS.address, '[ADDRESS]', redactions);
      
      // Redact names using NLP
      redactedText = redactNames(redactedText, redactions);
      break;
  }
  
  return {
    text: redactedText,
    redactions: redactions,
    redactionLevel
  };
}

function redactPattern(text, pattern, replacement, redactions) {
  return text.replace(pattern, (match) => {
    redactions.push({
      type: 'pattern',
      original: match,
      replacement: replacement,
      position: text.indexOf(match)
    });
    return replacement;
  });
}

function redactNames(text, redactions) {
  const doc = nlp(text);
  const people = doc.people();
  
  people.forEach(person => {
    const name = person.text();
    if (name.length > 2) { // Avoid redacting single letters or very short strings
      const replacement = '[NAME]';
      redactions.push({
        type: 'name',
        original: name,
        replacement: replacement,
        position: text.indexOf(name)
      });
      text = text.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
    }
  });
  
  return text;
}

export function extractMetadata(text) {
  const doc = nlp(text);
  
  // Extract emails
  const emails = [...text.matchAll(PII_PATTERNS.email)].map(match => match[0]);
  
  // Extract phone numbers
  const phones = [...text.matchAll(PII_PATTERNS.phone)].map(match => match[0]);
  
  // Extract names
  const people = doc.people().out('array');
  
  // Extract skills (common technical terms)
  const skills = [];
  const skillKeywords = [
    'javascript', 'python', 'java', 'react', 'node.js', 'mongodb', 'sql',
    'aws', 'docker', 'kubernetes', 'git', 'html', 'css', 'typescript',
    'angular', 'vue', 'express', 'django', 'flask', 'spring', 'mysql',
    'postgresql', 'redis', 'elasticsearch', 'machine learning', 'ai',
    'data science', 'analytics', 'project management', 'agile', 'scrum'
  ];
  
  skillKeywords.forEach(skill => {
    if (text.toLowerCase().includes(skill.toLowerCase())) {
      skills.push(skill);
    }
  });
  
  // Extract education
  const education = [];
  const educationKeywords = [
    'bachelor', 'master', 'phd', 'degree', 'university', 'college',
    'certification', 'certificate', 'diploma'
  ];
  
  educationKeywords.forEach(edu => {
    if (text.toLowerCase().includes(edu.toLowerCase())) {
      const sentences = text.split(/[.!?]+/);
      sentences.forEach(sentence => {
        if (sentence.toLowerCase().includes(edu.toLowerCase())) {
          education.push(sentence.trim());
        }
      });
    }
  });
  
  // Calculate experience years
  let experienceYears = 0;
  const experiencePattern = /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/gi;
  const experienceMatches = [...text.matchAll(experiencePattern)];
  if (experienceMatches.length > 0) {
    experienceYears = Math.max(...experienceMatches.map(match => parseInt(match[1])));
  }
  
  return {
    name: people[0] || null,
    email: emails[0] || null,
    phone: phones[0] || null,
    skills: [...new Set(skills)], // Remove duplicates
    education: [...new Set(education)],
    experience: experienceYears,
    summary: generateSummary(text)
  };
}

function generateSummary(text) {
  // Simple extractive summary - take first few sentences
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const summarySentences = sentences.slice(0, 3);
  return summarySentences.join('. ').trim() + '.';
}
