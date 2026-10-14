import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

type ChatMessage = {
  id: string;
  chatId: string;
  text: string;
  direction: "incoming" | "outgoing";
  createdAt: number;
};


function App() {
  const [apiUrl, setApiUrl] = useState("https://api.greenapi.com");
  const [idInstance, setIdInstance] = useState("");
  const [apiTokenInstance, setApiTokenInstance] = useState("");
  const [message, setMessage] = useState("");

  const [isConnected, setIsConnected] = useState(false);
  const [phone, setPhone] = useState("");
  const [selectedPhone, setSelectedPhone] = useState("");

  const [newMessage, setNewMessage] = useState("");
  
const [messages, setMessages] = useState<ChatMessage[]>(() => {
  try {
    const savedMessages = localStorage.getItem("whatsapp-chat-messages");

    if (savedMessages) {
      return JSON.parse(savedMessages) as ChatMessage[];
    }

    return [];
  } catch {
    return [];
  }
});
;

  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const [isReceiving, setIsReceiving] = useState(false);
  const [receiveInfo, setReceiveInfo] = useState("");

  const receivingRef = useRef(false);


useEffect(() => {
  localStorage.setItem(
    "whatsapp-chat-messages",
    JSON.stringify(messages)
  );
}, [messages]);



  async function handleConnect() {
    const instance = idInstance.trim();
    const token = apiTokenInstance.trim();

    if (!instance || !token) {
      setMessage("Заполните оба поля");
      return;
    }

    setMessage("Проверяем подключение...");

    try {

const url = `${apiUrl.trim().replace(/\/+$/, "")}/waInstance${encodeURIComponent(instance)}/getStateInstance/${encodeURIComponent(token)}`;

      const response = await fetch(url);

      if (!response.ok) {
        setMessage(`Ошибка API: ${response.status}`);
        return;
      }

      const data: { stateInstance: string } = await response.json();

      if (data.stateInstance === "authorized") {
        setMessage("");
        setIsConnected(true);
      } else {
        setMessage(`Статус: ${data.stateInstance}`);
      }
    } catch {
      setMessage("Не удалось выполнить запрос к GREEN-API");
    }
  }

  async function handleSendMessage() {
    const text = newMessage.trim();

    if (!text || !selectedPhone || isSending) return;

    setIsSending(true);
    setSendError("");

    try {

const url = `${apiUrl.trim().replace(/\/+$/, "")}/waInstance${encodeURIComponent(idInstance.trim())}/sendMessage/${encodeURIComponent(apiTokenInstance.trim())}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId: `${selectedPhone}@c.us`,
          message: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ошибка API: ${response.status}`);
      }

      const data: { idMessage?: string } = await response.json();

      if (!data.idMessage) {
        throw new Error("API не подтвердил отправку");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: data.idMessage!,
          chatId: `${selectedPhone}@c.us`,
          text,
          direction: "outgoing",
          createdAt: Date.now(),
        },
      ]);

      setNewMessage("");
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : "Ошибка отправки сообщения",
      );
    } finally {
      setIsSending(false);
    }
  }

  const handleReceiveMessage = useCallback(async () => {
    if (receivingRef.current) return;

    receivingRef.current = true;
    setIsReceiving(true);
    setReceiveInfo("Проверяем входящие...");

    try {

const baseUrl = `${apiUrl.trim().replace(/\/+$/, "")}/waInstance${encodeURIComponent(idInstance.trim())}`;
      const token = encodeURIComponent(apiTokenInstance.trim());

      const response = await fetch(`${baseUrl}/receiveNotification/${token}`);

      if (!response.ok) {
        throw new Error(`Ошибка API: ${response.status}`);
      }

      type Notification = {
        receiptId: number;
        body: {
          typeWebhook: string;
          senderData?: { chatId?: string };
          messageData?: {
            typeMessage?: string;
            textMessageData?: { textMessage?: string };
          };
        };
      };

      const notification: Notification | null = await response.json();

      if (!notification) {
        setReceiveInfo("Новых уведомлений нет");
        return;
      }

      const body = notification.body;
      const text = body.messageData?.textMessageData?.textMessage;
      const chatId = body.senderData?.chatId;

      const deleteResponse = await fetch(
        `${baseUrl}/deleteNotification/${token}/${notification.receiptId}`,
        { method: "DELETE" },
      );

      if (!deleteResponse.ok) {
        throw new Error("Не удалось удалить уведомление из очереди");
      }

      const deleteResult: { result: boolean } = await deleteResponse.json();

      if (!deleteResult.result) {
        throw new Error("Уведомление не удалено");
      }

      if (
        body.typeWebhook === "incomingMessageReceived" &&
        body.messageData?.typeMessage === "textMessage" &&
        typeof text === "string" &&
        chatId
      ) {
        setMessages((prev) => [
          ...prev,
          {
            id: `incoming-${notification.receiptId}`,
            chatId,
            text,
            direction: "incoming",
            createdAt: Date.now(),
          },
        ]);

        setReceiveInfo(
          chatId === `${selectedPhone}@c.us`
            ? "Сообщение получено!"
            : "Получено сообщение из другого чата",
        );
      } else {
        setReceiveInfo("Обработано служебное уведомление");
      }
    } catch (error) {
      setReceiveInfo(
        error instanceof Error ? error.message : "Ошибка получения",
      );
    } finally {
      receivingRef.current = false;
      setIsReceiving(false);
    }
}, [apiUrl, idInstance, apiTokenInstance, selectedPhone]);

  useEffect(() => {
    if (!isConnected || !selectedPhone) return;

    const intervalId = window.setInterval(() => {
      void handleReceiveMessage();
    }, 7000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isConnected, selectedPhone, handleReceiveMessage]);

  const chatMessages = messages
    .filter((item) => item.chatId === `${selectedPhone}@c.us`)
    .sort((a, b) => a.createdAt - b.createdAt);


const savedChats = [
  ...new Set(
    messages
      .map((item) => item.chatId)
      .filter((chatId) => chatId.endsWith('@c.us'))
  )
]



if (isConnected && selectedPhone) {
  return (
    <div className="login-page chat-page">

      <aside className="chat-sidebar">
        <h2>Мои чаты</h2>

      

{savedChats.map((chatId) => {
  const chatHistory = messages.filter(
    (item) => item.chatId === chatId
  )

  const lastMessage = [...chatHistory].sort(
    (a, b) => b.createdAt - a.createdAt
  )[0]

  return (
    <button
      key={chatId}
      type="button"
      className={
        chatId === `${selectedPhone}@c.us`
          ? 'chat-item active'
          : 'chat-item'
      }
      onClick={() =>
        setSelectedPhone(chatId.replace(/@c\.us$/, ''))
      }
    >
      <span className="chat-phone">
        {chatId.replace(/@c\.us$/, '')}
      </span>

      <span className="chat-preview">
        {lastMessage?.text || 'Нет сообщений'}
      </span>
    </button>
  )
})}




      </aside>

      <div className="login-card chat-main">
        <h1>WhatsApp Chat</h1>

        <h2>Чат с {selectedPhone}</h2>


          <div className="messages">
            {chatMessages.length === 0 ? (
              <p className="empty-chat">Сообщений пока нет</p>
            ) : (
              chatMessages.map((item) => (
                <div
                  key={item.id}
                  className={
                    item.direction === "outgoing"
                      ? "message-bubble"
                      : "incoming-bubble"
                  }
                >
                  {item.text}
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSendMessage();
            }}
          >
            <input
              type="text"
              placeholder="Введите сообщение..."
              value={newMessage}
              onChange={(event) => setNewMessage(event.target.value)}
            />

            <button type="submit" disabled={isSending}>
              {isSending ? "Отправляем..." : "Отправить"}
            </button>

            {sendError && <p>{sendError}</p>}
          </form>

          <button
            type="button"
            onClick={() => void handleReceiveMessage()}
            disabled={isReceiving}
          >
            {isReceiving ? "Получаем..." : "Получить сообщения"}
          </button>

          {receiveInfo && <p>{receiveInfo}</p>}

          <button type="button" onClick={() => setSelectedPhone("")}>
            Назад к выбору номера
          </button>
        </div>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>WhatsApp Chat</h1>
          <p>Создание нового чата</p>

          <label htmlFor="phone">Номер телефона получателя</label>

          <input
            id="phone"
            type="tel"
            placeholder="Например, 346XXXXXXXX"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />

          <button
            type="button"
            onClick={() => {
              const cleanPhone = phone.replace(/\D/g, "");

              if (cleanPhone.length < 10 || cleanPhone.length > 15) {
                setMessage("Введите номер с кодом страны (10–15 цифр)");
                return;
              }

              setMessage("");
              setSelectedPhone(cleanPhone);
            }}
          >
            Выбрать получателя
          </button>

          <p>{message}</p>

{savedChats.length > 0 && (
  <div className="saved-chats">
    <h2>Сохранённые чаты</h2>

    {savedChats.map((chatId) => (
      <button
        key={chatId}
        type="button"
        onClick={() => {
          setMessage('')
          setSelectedPhone(chatId.replace(/@c\.us$/, ''))
        }}
      >
        {chatId.replace(/@c\.us$/, '')}
      </button>
    ))}
  </div>
)}

        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>WhatsApp Chat</h1>

        <p>Подключение через GREEN-API</p>


<label htmlFor="apiUrl">API URL</label>
<input
  id="apiUrl"
  type="url"
  placeholder="https://api.greenapi.com"
  value={apiUrl}
  onChange={(event) => setApiUrl(event.target.value)}
/>


        <label htmlFor="instance">ID Instance</label>
        <input
          id="instance"
          type="text"
          placeholder="Введите idInstance"
          value={idInstance}
          onChange={(event) => setIdInstance(event.target.value)}
        />

        <label htmlFor="token">API Token Instance</label>
        <input
          id="token"
          type="password"
          placeholder="Введите apiTokenInstance"
          value={apiTokenInstance}
          onChange={(event) => setApiTokenInstance(event.target.value)}
        />

        <button type="button" onClick={handleConnect}>
          Подключиться
        </button>

        <p>{message}</p>
      </div>
    </div>
  );
}

export default App;
