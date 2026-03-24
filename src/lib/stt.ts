export async function speechToText(url: string) {
  try {
    const audioResponse = await fetch(url);
    if (!audioResponse.ok) throw new Error("Failed to fetch audio from URL");
    
    const arrayBuffer = await audioResponse.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: 'audio/ogg' });
    
    const formData = new FormData();
    formData.append('file', blob, 'audio.ogg');
    formData.append('model', 'whisper-1');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || process.env.AI_API_KEY}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "OpenAI STT failed");
    }
    
    return await response.json();
  } catch (error) {
    console.error("STT Error:", error);
    return { text: "" };
  }
}
