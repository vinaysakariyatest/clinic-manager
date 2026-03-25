export async function sendWhatsAppMessage(phoneNumberId: string, to: string, message: string) {
  const token = process.env.WHATSAPP_TOKEN;
  
  if (!token) {
    console.error("WHATSAPP_TOKEN is not set in environment variables");
    return;
  }

  // 11za Text Message Endpoint (Internal/New)
  const url = `https://internal.11za.in/apis/sendMessage/sendMessages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sendto: to,
        authToken: token,
        originWebsite: "https://engees.in",
        contentType: "text",
        text: message,
      }),
    });

    const data = await response.json();
    console.log("11za API Response:", data);
    return data;
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    throw error;
  }
}
