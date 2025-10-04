import cosineSimilarity from 'compute-cosine-similarity';

// Simple mock embeddings for demo purposes
export async function generateEmbedding(text) {
  // Create a simple hash-based embedding for demo
  const hash = text.toLowerCase().split('').reduce((hash, char) => {
    return (hash << 5) - hash + char.charCodeAt(0);
  }, 0);
  
  // Generate a 384-dimensional embedding based on text content
  const embedding = [];
  const words = text.toLowerCase().split(/\s+/);
  
  for (let i = 0; i < 384; i++) {
    let value = Math.sin(hash + i) * 0.5;
    
    // Add some word-based features
    words.forEach((word, wordIndex) => {
      value += Math.sin(word.charCodeAt(0) + i + wordIndex) * 0.1;
    });
    
    embedding.push(value);
  }
  
  // Normalize the embedding
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / norm);
}

export async function generateEmbeddings(texts) {
  return Promise.all(texts.map(text => generateEmbedding(text)));
}

export function findSimilarChunks(queryEmbedding, chunks, topK = 5) {
  const similarities = chunks.map((chunk, index) => ({
    index,
    chunk,
    similarity: computeCosineSimilarity(queryEmbedding, chunk.embedding)
  }));
  
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

function computeCosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
