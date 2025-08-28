"use client";

import { useState } from "react";

export default function LeadCTA({ score, url }: { score: number; url: string }) {
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    sitio: url || "",
    comentario: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg(null);

    try {
      // ⬇️ MAPEAMOS tus campos -> lo que espera n8n
      const payload = {
        name: form.nombre,           // n8n espera "name"
        email: form.email,           // n8n espera "email"
        message: form.comentario,    // n8n espera "message"
        url: form.sitio,             // opcional, pero útil (n8n lo usa como "url")
      };

      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || "Error enviando");
      }

      setStatus("ok");
      // opcional: limpiar formulario
      setForm({ nombre: "", email: "", sitio: "", comentario: "" });
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message || "Error desconocido");
    }
  };

  return (
    <div className="p-6 bg-[#1e1e2f] rounded-md text-white max-w-md mx-auto my-8">
      <h2 className="text-lg font-bold mb-4">Mejorar mi puntaje</h2>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          name="nombre"
          placeholder="Nombre"
          value={form.nombre}
          onChange={handleChange}
          className="w-full p-2 rounded bg-[#2c2c3c] border border-gray-600"
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          className="w-full p-2 rounded bg-[#2c2c3c] border border-gray-600"
          required
        />
        <input
          type="text"
          name="sitio"
          placeholder="Sitio (https://...)"
          value={form.sitio}
          onChange={handleChange}
          className="w-full p-2 rounded bg-[#2c2c3c] border border-gray-600"
          required
        />
        <textarea
          name="comentario"
          placeholder="Comentario (opcional)"
          value={form.comentario}
          onChange={handleChange}
          className="w-full p-2 rounded bg-[#2c2c3c] border border-gray-600"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full bg-violet-500 hover:bg-violet-600 disabled:opacity-60 text-white font-semibold py-2 px-4 rounded"
        >
          {status === "loading" ? "Enviando..." : "Enviar"}
        </button>
      </form>

      {status === "ok" && <p className="text-green-400 mt-3">¡Enviado con éxito!</p>}
      {status === "error" && (
        <p className="text-red-400 mt-3">Ocurrió un error. {errorMsg ? `(${errorMsg})` : "Revisá el servidor."}</p>
      )}
    </div>
  );
}
