// Acumulador de verificacoes: cada check vira uma linha PASS/FAIL/AVISO no stdout,
// um item no resultados.json e uma secao no resumo.md.
import fs from "node:fs";
import path from "node:path";

export function carimbo(data = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}T${p(data.getHours())}${p(data.getMinutes())}${p(data.getSeconds())}`;
}

export class Verificacao {
  constructor(nome, { dir } = {}) {
    this.nome = nome;
    this.dir = dir || path.join("output", "qa", `${nome}-${carimbo()}`);
    this.shots = path.join(this.dir, "shots");
    fs.mkdirSync(this.shots, { recursive: true });
    this.itens = [];
    this.avisos = [];
    this.comecou = new Date();
  }

  check(nome, ok, detalhe = "") {
    const item = { nome, resultado: ok ? "PASS" : "FAIL", detalhe: String(detalhe ?? "") };
    this.itens.push(item);
    const marca = ok ? "PASS " : "FAIL ";
    console.log(`[${marca}] ${nome}${item.detalhe ? ` — ${item.detalhe}` : ""}`);
    return ok;
  }

  aviso(nome, detalhe = "") {
    const item = { nome, resultado: "AVISO", detalhe: String(detalhe ?? "") };
    this.itens.push(item);
    console.log(`[AVISO] ${nome}${item.detalhe ? ` — ${item.detalhe}` : ""}`);
    return false;
  }

  nota(texto) {
    console.log(`        ${texto}`);
  }

  get total() {
    return this.itens.filter((i) => i.resultado !== "AVISO").length;
  }

  get falhas() {
    return this.itens.filter((i) => i.resultado === "FAIL");
  }

  get passes() {
    return this.itens.filter((i) => i.resultado === "PASS");
  }

  async screenshot(page, nome) {
    const arquivo = path.join(this.shots, `${nome.replace(/[^\w.-]+/g, "_")}.png`);
    try {
      await page.screenshot({ path: arquivo, fullPage: false });
      return arquivo;
    } catch (erro) {
      this.aviso(`screenshot ${nome}`, String(erro.message || erro));
      return null;
    }
  }

  /** Grava resultados.json + resumo.md e devolve os caminhos. */
  salvar(meta = {}) {
    const fim = new Date();
    const dados = {
      nome: this.nome,
      inicio: this.comecou.toISOString(),
      fim: fim.toISOString(),
      duracao_segundos: Math.round((fim - this.comecou) / 1000),
      base_url: meta.base,
      itens: this.itens,
      resumo: {
        total: this.itens.length,
        passes: this.passes.length,
        falhas: this.falhas.length,
        avisos: this.itens.length - this.passes.length - this.falhas.length,
      },
      meta,
    };
    const json = path.join(this.dir, "resultados.json");
    fs.writeFileSync(json, `${JSON.stringify(dados, null, 2)}\n`, "utf8");

    const linhas = [
      `# Verificacao ${this.nome}`,
      "",
      `- Inicio: ${dados.inicio}`,
      `- Base URL: ${meta.base || "-"}`,
      `- PASS: ${dados.resumo.passes} | FAIL: ${dados.resumo.falhas} | AVISO: ${dados.resumo.avisos}`,
      "",
      "| Resultado | Check | Detalhe |",
      "|---|---|---|",
      ...this.itens.map((i) => `| ${i.resultado} | ${i.nome.replace(/\|/g, "\\|")} | ${String(i.detalhe || "").replace(/\|/g, "\\|").replace(/\n/g, " ")} |`),
      "",
      `Screenshots: \`${path.relative(process.cwd(), this.shots).replace(/\\/g, "/")}\``,
      "",
    ];
    const md = path.join(this.dir, "resumo.md");
    fs.writeFileSync(md, linhas.join("\n"), "utf8");
    return { json, md, dir: this.dir };
  }
}
