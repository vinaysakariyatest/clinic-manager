export async function sendWhatsAppMessage(phoneNumberId: string, to: string, message: string) {
  const token = process.env.WHATSAPP_TOKEN;
  
  if (!token) {
    console.error("WHATSAPP_TOKEN is not set in environment variables");
    return;
  }

  const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: message },
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    throw error;
  }
}
