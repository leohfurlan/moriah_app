#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gerador do documento .pen (JSON v2.17) — mockup SaaS de gestão de igrejas.
13 telas desktop 1440x1024, sidebar fixa, navegação por href nos textos.
Saída: design/moriah_mockup.pen
"""
import json

W, H, SB, TOP = 1440, 1024, 280, 92
CX, CW = SB + 36, W - SB - 72          # área de conteúdo (absoluta)
CH = H - TOP - 34
SHADOW = {"type": "shadow", "shadowType": "outer", "offset": {"x": 0, "y": 8},
          "blur": 20, "spread": -16, "color": "#10182833"}

COLOR_VARS = {
    "bg": "#F6F7FB", "surface": "#FFFFFF", "side": "#101828", "muted": "#667085",
    "text": "#101828", "line": "#E4E7EC", "primary": "#4F46E5", "primarySoft": "#EEF2FF",
    "green": "#12B76A", "greenSoft": "#ECFDF3", "amber": "#F79009", "amberSoft": "#FFFAEB",
    "red": "#F04438", "redSoft": "#FEF3F2", "blueSoft": "#EFF8FF",
}

_counters = {}
def nid(kind):
    _counters[kind] = _counters.get(kind, 0) + 1
    return f"{kind}{_counters[kind]:03d}"

def node(kind, parent, name, **kw):
    d = {"id": nid(kind), "type": kind, "name": name}
    d.update(kw)
    parent.setdefault("children", []).append(d)
    return d

def frame(p, name, **kw):  return node("frame", p, name, **kw)
def rect(p, name, **kw):   return node("rectangle", p, name, **kw)
def text(p, name, content, href=None, **kw):
    kw.setdefault("fontFamily", "$font"); kw.setdefault("fill", "$text")
    if href: kw["href"] = href
    return node("text", p, name, content=content, **kw)
def icon(p, name, ic, **kw):
    kw.setdefault("fill", "$muted")
    return node("icon", p, name, library="lucide", icon=ic, **kw)

# ---------------------------------------------------------------- helpers UI

def card(p, name, x, y, w, h):
    return frame(p, name, x=x, y=y, width=w, height=h, fill="$surface",
                 cornerRadius=16, stroke="$line", strokeWidth=1, effect=SHADOW,
                 layout="vertical", padding=18, gap=10)

def button(p, label, primary=False, href=None, h=40):
    kw = {} if primary else {"stroke": "$line", "strokeWidth": 1}
    b = frame(p, "Botão " + label, height=h,
              fill="$primary" if primary else "#FFFFFF",
              cornerRadius=12, layout="horizontal", alignItems="center",
              justifyContent="center", gap=8, padding=[0, 16], **kw)
    text(b, "Label botão", label, href=href, fontSize=13, fontWeight="700",
         fill="#FFFFFF" if primary else "$text")
    return b

def stat(p, name, val, sub, ic):
    c = frame(p, "Card " + name, width="fill_container", height=112,
              fill="$surface", cornerRadius=16, stroke="$line", strokeWidth=1,
              effect=SHADOW, layout="vertical", padding=16, gap=8)
    h = frame(c, "Topo " + name, width="fill_container", layout="horizontal",
              justifyContent="space_between", alignItems="center")
    text(h, "Label " + name, name, fontSize=12, fill="$muted")
    ib = frame(h, "Ícone box", width=32, height=32, cornerRadius=10,
               fill="$primarySoft", layout="horizontal", alignItems="center",
               justifyContent="center")
    icon(ib, "Ícone " + name, ic, width=16, height=16, fill="$primary")
    text(c, "Valor " + name, val, fontSize=24, fontWeight="750")
    text(c, "Sub " + name, sub, fontSize=11, fill="$muted")

BADGE = {"ok": ("$greenSoft", "#067647"), "wait": ("$amberSoft", "#B54708"),
         "rev": ("#FFF1F3", "#C01048"), "can": ("$redSoft", "#B42318"),
         "info": ("$blueSoft", "#175CD3")}
def badge(p, label, color):
    bg, fg = BADGE.get(color, BADGE["info"])
    b = frame(p, "Badge " + label, fill=bg, cornerRadius=99,
              layout="horizontal", padding=[5, 9], alignItems="center",
              justifyContent="center")
    text(b, "Texto badge", label, fontSize=11, fontWeight="650", fill=fg)

def barChart(p, series, chart_h=240, bar_h=170):
    ch = frame(p, "Gráfico barras", width="fill_container", height=chart_h,
               layout="horizontal", gap=18, alignItems="end", padding=[20, 12, 12, 12])
    for m, a, b in series:
        col = frame(ch, "Mês " + m, width="fill_container", height="fill_container",
                    layout="vertical", justifyContent="end", alignItems="center", gap=8)
        bars = frame(col, "Barras " + m, height=bar_h, layout="horizontal",
                     alignItems="end", gap=4)
        rect(bars, "Dízimos " + m, width=13, height=a, fill="$primary", cornerRadius=[6, 6, 2, 2])
        rect(bars, "Ofertas " + m, width=13, height=b, fill="#7C3AED", opacity=.45, cornerRadius=[6, 6, 2, 2])
        text(col, "Label " + m, m, fontSize=11, fill="$muted")

def table(p, cols, rows, x, y, w, h):
    tb = frame(p, "Tabela", x=x, y=y, width=w, height=h, fill="$surface", cornerRadius=16,
               stroke="$line", strokeWidth=1, layout="vertical", clip=True)
    head = frame(tb, "Cabeçalho tabela", width="fill_container", height=44,
                 fill="#F9FAFB", layout="horizontal", alignItems="center",
                 padding=[0, 16], gap=12)
    for c in cols:
        text(head, "Coluna " + c, c, fontSize=11, fontWeight="700", fill="$muted",
             width="fill_container", textGrowth="fixed-width")
    for r in rows:
        row = frame(tb, "Linha " + str(r[0]), width="fill_container",
                    layout="horizontal", alignItems="center", padding=[0, 16], gap=12,
                    stroke="#EAECF0", strokeWidth={"bottom": 1})
        for cell in r:
            wrap = frame(row, "Célula", width="fill_container", layout="horizontal",
                         alignItems="center")
            if isinstance(cell, tuple):
                badge(wrap, cell[0], cell[1])
            elif isinstance(cell, dict):
                text(wrap, "Link célula", cell["t"], href=cell.get("href"),
                     fontSize=12, fontWeight="650", fill="$primary",
                     textGrowth="fixed-width", width="fill_container")
            else:
                money = "R$" in cell
                text(wrap, "Texto célula", cell, fontSize=12,
                     fill="$text" if money else "#344054",
                     fontWeight="700" if money else "500",
                     textGrowth="fixed-width", width="fill_container")

def bulletList(p, items, title=None):
    if title: text(p, "Título lista", title, fontSize=16, fontWeight="700")
    for it in items:
        r = frame(p, "Item " + it, width="fill_container", layout="horizontal",
                  gap=10, alignItems="start")
        rect(r, "Ponto", width=8, height=8, cornerRadius=4, fill="$primary")
        text(r, "Texto " + it, it, fontSize=12, fill="#344054",
             textGrowth="fixed-width", width="fill_container")

def field(p, label, value, href=None):
    text(p, "Label " + label, label, fontSize=12, fontWeight="700", fill="#344054")
    inp = frame(p, "Campo " + label, width="fill_container", height=52,
                fill="#FFFFFF", stroke="$line", strokeWidth=1, cornerRadius=12,
                layout="horizontal", alignItems="center", justifyContent="space_between",
                padding=[0, 14])
    text(inp, "Valor campo", value, fontSize=14, fontWeight="650")
    icon(inp, "Chevron", "chevron-down", width=16, height=16)

# ---------------------------------------------------------------- navegação

LINKS = []           # (textnode, chave-destino) a resolver depois
def navText(p, name, content, key, **kw):
    t = text(p, name, content, **kw)
    LINKS.append((t, key)); return t

SECTIONS = [
    ("Dashboard", ["Dashboard"]),
    ("Pessoas", ["Membros", "Visitantes", "Famílias"]),
    ("Financeiro", ["Dízimos e Ofertas", "Minhas contribuições", "Contribuições recebidas",
                    "Categorias", "Relatórios"]),
    ("Ministérios", ["Ministérios", "Equipes", "Escalas"]),
    ("Ensino", ["Escola Bíblica", "Cursos", "Turmas", "Professores", "Alunos", "Aulas", "Materiais"]),
    ("Cultos e Eventos", ["Agenda", "Cultos", "Eventos", "Programações"]),
    ("Comunicação", ["Avisos", "Notificações"]),
    ("Administração", ["Usuários e permissões", "Configurações da igreja"]),
]
def navIcon(it):
    if it == "Dashboard": return "layout-dashboard"
    if "contribui" in it or it == "Dízimos e Ofertas": return "circle-dollar-sign"
    if it == "Escalas": return "calendar-check"
    if it == "Agenda": return "calendar-days"
    if it == "Escola Bíblica": return "book-open"
    if it == "Membros": return "users"
    if it == "Avisos": return "megaphone"
    return "circle"

SIDEBAR_KEY = {
    "Dashboard": "tela1", "Minhas contribuições": "tela2", "Contribuições recebidas": "tela4",
    "Escola Bíblica": "tela6", "Turmas": "tela6", "Escalas": "tela8", "Agenda": "tela10",
    "Cultos": "tela10", "Avisos": "tela13", "Membros": "tela12", "Dízimos e Ofertas": "tela2",
}

def build_sidebar(s, active):
    b = frame(s, "Sidebar fixa", x=0, y=0, width=SB, height=H, fill="$side",
              layout="vertical", padding=[28, 18], gap=20)
    brand = frame(b, "Marca", width="fill_container", layout="horizontal",
                  gap=12, alignItems="center")
    mark = frame(brand, "Símbolo Luz", width=38, height=38, fill="#4F46E5",
                 cornerRadius=12, layout="horizontal", alignItems="center",
                 justifyContent="center")
    text(mark, "L", "M", fontSize=18, fontWeight="700", fill="#FFFFFF")
    bn = frame(brand, "Nome produto", layout="vertical", gap=2)
    text(bn, "LumenChurch", "LumenChurch", fontSize=17, fontWeight="700", fill="#FFFFFF")
    text(bn, "Plano", "Igreja Nova Aliança", fontSize=11, fill="#98A2B3")
    for h_, items in SECTIONS:
        sec = frame(b, "Menu " + h_, width="fill_container", layout="vertical", gap=2)
        text(sec, "Grupo " + h_, h_.upper(), fontSize=10, letterSpacing=1.2,
             fontWeight="700", fill="#667085")
        for it in items:
            is_act = it == active
            row = frame(sec, "Nav " + it, width="fill_container", height=26,
                        layout="horizontal", gap=9, alignItems="center",
                        padding=[0, 10], cornerRadius=9,
                        fill="#27315A" if is_act else "#101828")
            icon(row, "Ícone " + it, navIcon(it), width=15, height=15,
                 fill="#FFFFFF" if is_act else "#98A2B3")
            if it in SIDEBAR_KEY:
                navText(row, "Rótulo " + it, it, SIDEBAR_KEY[it],
                        fontSize=13, fontWeight="600" if is_act else "500",
                        fill="#FFFFFF" if is_act else "#B6BDCB")
            else:
                text(row, "Rótulo " + it, it, fontSize=13,
                     fontWeight="600" if is_act else "500",
                     fill="#FFFFFF" if is_act else "#B6BDCB")

def build_topbar(s, title):
    t = frame(s, "Topbar", x=SB, y=0, width=W - SB, height=TOP, fill="$bg",
              layout="horizontal", alignItems="center", justifyContent="space_between",
              padding=[24, 36])
    left = frame(t, "Saudação", layout="vertical", gap=5)
    text(left, "Igreja", "Igreja Nova Aliança", fontSize=13, fill="$muted")
    text(left, "Título", title, fontSize=24, fontWeight="700")
    r = frame(t, "Ações topo", layout="horizontal", gap=14, alignItems="center")
    search = frame(r, "Busca global", width=280, height=42, fill="#FFFFFF",
                   stroke="$line", strokeWidth=1, cornerRadius=12,
                   layout="horizontal", gap=10, alignItems="center", padding=[0, 14])
    icon(search, "Ícone busca", "search", width=17, height=17)
    text(search, "Placeholder busca", "Buscar pessoas, eventos, contribuições...",
         fontSize=12, fill="$muted")
    bell = frame(r, "Notificações", width=42, height=42, fill="#FFFFFF",
                 stroke="$line", strokeWidth=1, cornerRadius=12,
                 layout="horizontal", alignItems="center", justifyContent="center")
    icon(bell, "Sino", "bell", width=18, height=18)
    av = frame(r, "Perfil topbar", layout="horizontal", gap=10, alignItems="center")
    a = frame(av, "Avatar Mariana", width=38, height=38, cornerRadius=19,
              fill="#DDE5FF", layout="horizontal", alignItems="center",
              justifyContent="center")
    text(a, "Iniciais", "MC", fontSize=13, fontWeight="700", fill="$primary")
    text(av, "Usuário", "Mariana Costa", fontSize=13, fontWeight="600")

def content(s):
    return frame(s, "Conteúdo", x=CX, y=TOP, width=CW, height=CH, layout="none")

# ---------------------------------------------------------------- telas

def tela1(c):
    grid = frame(c, "Indicadores", x=0, y=0, width=1088, height=244,
                 layout="vertical", gap=16)
    for row in [[["Membros ativos", "1.284", "+36 nos últimos 30 dias", "users"],
                 ["Visitantes no mês", "87", "18 retornaram ao culto", "user-plus"],
                 ["Dízimos e ofertas", "R$ 86.420", "+12,4% vs mês anterior", "circle-dollar-sign"]],
                [["Cultos no mês", "18", "4 programações especiais", "calendar-days"],
                 ["Próximo culto", "Dom 19h", "Culto de celebração", "church"],
                 ["Ministérios ativos", "14", "3 escalas pendentes", "sparkles"]]]:
        rr = frame(grid, "Linha indicadores", width="fill_container", height=114,
                   layout="horizontal", gap=16)
        for it in row: stat(rr, *it)
    ch = card(c, "Contribuições últimos 6 meses", 0, 272, 690, 300)
    chh = frame(ch, "Título gráfico", width="fill_container", layout="horizontal",
                justifyContent="space_between", alignItems="center")
    text(chh, "Título contribuições", "Contribuições", fontSize=17, fontWeight="700")
    text(chh, "Legenda", "Dízimos  Ofertas", fontSize=12, fill="$muted")
    barChart(ch, [["Ago", 92, 48], ["Set", 118, 58], ["Out", 106, 62],
                  ["Nov", 135, 72], ["Dez", 148, 90], ["Jan", 126, 64]])
    quick = card(c, "Ações rápidas", 714, 272, 374, 300)
    for q, href in [("Registrar contribuição", "tela3"), ("Adicionar membro", None),
                    ("Criar culto", None), ("Criar escala", "tela9"), ("Criar turma", None)]:
        r = frame(quick, "Ação " + q, width="fill_container", height=44,
                  fill="$primarySoft" if href == "tela3" else "#F9FAFB",
                  cornerRadius=12, layout="horizontal", alignItems="center",
                  gap=10, padding=[0, 12])
        icon(r, "Ícone " + q,
             "plus-circle" if "contrib" in q else "user-plus" if "membro" in q
             else "church" if "culto" in q else "calendar-check" if "escala" in q
             else "graduation-cap",
             width=17, height=17,
             fill="$primary" if href == "tela3" else "$muted")
        if href:
            navText(r, "Texto " + q, q, href, fontSize=13, fontWeight="650",
                    fill="$primary" if href == "tela3" else "$text")
        else:
            text(r, "Texto " + q, q, fontSize=13, fontWeight="650",
                 fill="$primary" if href == "tela3" else "$text")
    for x, w, t, items in [
        [0, 266, "Próximos cultos", ["Dom 19h • Celebração • Templo", "Qua 20h • Ensino • Sala 2", "Sáb 17h • Jovens • Auditório"]],
        [280, 266, "Próximas escalas", ["Louvor • Vocal • João Lima", "Mídia • Projeção • Ana Souza", "Recepção • 10h • Fernanda Alves"]],
        [560, 266, "Aniversariantes", ["Fernanda Alves • 14 jan", "Rafael Nunes • 21 jan", "Helena Prado • 28 jan"]],
        [840, 248, "Atividades recentes", ["Nova contribuição • Mariana • R$ 450", "Novo membro • Daniel Pereira", "Escala confirmada • Lucas", "Evento criado • Retiro de casais"]]]:
        ca = card(c, t, x, 600, w, 264)
        bulletList(ca, items)
    return {"tela2": None}

def tela2(c, T):
    h1 = frame(c, "Header Minhas", x=0, y=0, width=1088, layout="horizontal",
               justifyContent="space_between", alignItems="center")
    ht = frame(h1, "Texto header", layout="vertical", gap=8)
    text(ht, "Título", "Minhas contribuições", fontSize=30, fontWeight="760")
    text(ht, "Subtexto", "Acompanhe seus dízimos, ofertas e demais contribuições.",
         fontSize=14, fill="$muted")
    button(h1, "+ Registrar contribuição", True, href=T["tela3"])
    sr = frame(c, "Resumo minhas", x=0, y=96, width=1088, height=112,
               layout="horizontal", gap=16)
    for it in [["Total mês", "R$ 1.250", "3 contribuições", "wallet"],
               ["Total ano", "R$ 8.740", "+9% vs ano anterior", "trending-up"],
               ["Última contribuição", "R$ 450", "Dízimo • 12 jan", "receipt"],
               ["Aguardando confirmação", "2", "Em análise financeira", "clock"]]:
        stat(sr, *it)
    ch = card(c, "Evolução mensal", 0, 236, 1088, 248)
    text(ch, "Título evolução", "Evolução mensal das contribuições", fontSize=17, fontWeight="700")
    barChart(ch, [["Ago", 58, 16], ["Set", 64, 20], ["Out", 72, 18],
                  ["Nov", 80, 28], ["Dez", 94, 34], ["Jan", 70, 26]])
    flt = frame(c, "Filtros", x=0, y=508, width=1088, height=52,
                layout="horizontal", gap=12)
    for f in ["Período: últimos 12 meses", "Categoria: todas", "Status: todos"]:
        button(flt, f, False)
    table(c, ["Data", "Categoria", "Valor", "Comprovante", "Status", "Ações"],
          [["12/01/2026", "Dízimo", "R$ 450,00", "recibo-jan.pdf",
            ("Aguardando confirmação", "wait"), {"t": "Ver", "href": T["tela5"]}],
           ["08/01/2026", "Missões", "R$ 120,00", "pix-missoes.png",
            ("Confirmada", "ok"), {"t": "Ver", "href": T["tela5"]}],
           ["22/12/2025", "Oferta", "R$ 80,00", "oferta.jpg",
            ("Confirmada", "ok"), {"t": "Ver", "href": T["tela5"]}],
           ["10/12/2025", "Campanha", "R$ 250,00", "campanha.pdf",
            ("Necessita revisão", "rev"), {"t": "Corrigir", "href": T["tela5"]}],
           ["02/12/2025", "Evento", "R$ 60,00", "evento.png",
            ("Cancelada", "can"), {"t": "Ver", "href": T["tela5"]},]],
          0, 584, 1088, 292)

def tela3(c, T):
    form = card(c, "Formulário registrar", 160, 24, 768, 838)
    text(form, "Título registrar", "Registrar contribuição", fontSize=28, fontWeight="760")
    text(form, "Ajuda", "Envie os dados e o comprovante. A tesouraria fará a conferência antes da confirmação.",
         fontSize=14, fill="$muted", textGrowth="fixed-width", width="fill_container")
    for l, v in [["Valor da contribuição", "R$ 450,00"], ["Tipo da contribuição", "Dízimo"],
                 ["Data", "12/01/2026"]]:
        text(form, "Label " + l, l, fontSize=12, fontWeight="700", fill="#344054")
        inp = frame(form, "Campo " + l, width="fill_container", height=52,
                    fill="#FFFFFF", stroke="$line", strokeWidth=1, cornerRadius=12,
                    layout="horizontal", alignItems="center", padding=[0, 14])
        text(inp, "Valor campo " + l, v, fontSize=15, fontWeight="600")
    text(form, "Label obs", "Observação opcional", fontSize=12, fontWeight="700", fill="#344054")
    obs = frame(form, "Campo observação", width="fill_container", height=82,
                fill="#FFFFFF", stroke="$line", strokeWidth=1, cornerRadius=12, padding=14)
    text(obs, "Texto obs", "Transferência realizada via PIX após o culto de domingo.",
         fontSize=13, fill="$muted", textGrowth="fixed-width", width="fill_container")
    text(form, "Label upload", "Upload do comprovante", fontSize=12, fontWeight="700", fill="#344054")
    up = frame(form, "Área drag and drop", width="fill_container", height=140,
               fill="#F9FAFB", stroke="#C7D2FE", strokeWidth=1, cornerRadius=16,
               layout="vertical", alignItems="center", justifyContent="center", gap=8)
    icon(up, "Ícone upload", "upload-cloud", width=30, height=30, fill="$primary")
    text(up, "Texto upload", "Arraste o comprovante aqui ou clique para selecionar.",
         fontSize=14, fontWeight="650")
    text(up, "Tipos aceitos", "PDF, JPG ou PNG até 10 MB", fontSize=12, fill="$muted")
    file = frame(form, "Arquivo enviado", width="fill_container", height=64,
                 fill="#FFFFFF", stroke="$line", strokeWidth=1, cornerRadius=12,
                 layout="horizontal", alignItems="center", gap=12, padding=[0, 14])
    ib = frame(file, "Ícone arquivo", width=40, height=40, cornerRadius=10,
               fill="$primarySoft", layout="horizontal", alignItems="center",
               justifyContent="center")
    icon(ib, "file", "file-text", width=20, height=20, fill="$primary")
    fi = frame(file, "Info arquivo", layout="vertical", gap=3, width="fill_container")
    text(fi, "Nome arquivo", "comprovante-pix-jan.pdf", fontSize=13, fontWeight="650")
    text(fi, "Tamanho", "412 KB • enviado agora", fontSize=11, fill="$muted")
    icon(file, "Remover", "x", width=18, height=18, fill="$red")
    acts = frame(form, "Ações form", width="fill_container", layout="horizontal", gap=12)
    button(acts, "Enviar contribuição", True)
    button(acts, "Cancelar", False, href=T["tela2"])
    ok = frame(form, "Feedback sucesso", width="fill_container", height=64,
               fill="$greenSoft", cornerRadius=12, layout="horizontal",
               alignItems="center", gap=10, padding=[0, 14])
    icon(ok, "check", "check-circle-2", width=20, height=20, fill="$green")
    text(ok, "Mensagem sucesso", "Contribuição registrada com sucesso. O comprovante será analisado pela tesouraria.",
         fontSize=13, fontWeight="650", fill="#067647")

def tela4(c, T):
    head = frame(c, "Header financeiro", x=0, y=0, width=1088, layout="horizontal",
                 justifyContent="space_between", alignItems="center")
    text(head, "Título financeiro", "Gestão financeira", fontSize=30, fontWeight="760")
    ha = frame(head, "Ações financeiro", layout="horizontal", gap=10)
    button(ha, "Exportar relatórios", False)
    button(ha, "Validar pendentes", True)
    fstats = frame(c, "Cards financeiro", x=0, y=72, width=1088, height=112,
                   layout="horizontal", gap=14)
    for it in [["Total recebido", "R$ 86.420", "Janeiro 2026", "landmark"],
               ["Dízimos", "R$ 61.800", "71% do total", "circle-dollar-sign"],
               ["Ofertas", "R$ 15.240", "+8% no mês", "hand-heart"],
               ["Outras", "R$ 9.380", "Missões/campanhas", "layers"],
               ["Aguardando", "18", "Precisam conferência", "clock"]]:
        stat(fstats, *it)
    ch = card(c, "Arrecadação mensal", 0, 212, 670, 268)
    text(ch, "Título arrecadação", "Arrecadação mensal", fontSize=17, fontWeight="700")
    barChart(ch, [["Ago", 88, 34], ["Set", 98, 38], ["Out", 110, 42],
                  ["Nov", 120, 54], ["Dez", 148, 72], ["Jan", 128, 52]])
    dist = card(c, "Distribuição categoria", 696, 212, 392, 268)
    text(dist, "Título distribuição", "Distribuição por categoria", fontSize=17, fontWeight="700")
    for lab, w, col in [["Dízimos", 76, "$primary"], ["Ofertas", 18, "#7C3AED"],
                        ["Missões", 9, "#0EA5E9"], ["Campanhas e eventos", 12, "#F79009"]]:
        r = frame(dist, "Linha " + lab, width="fill_container", layout="vertical", gap=6)
        top = frame(r, "Info " + lab, width="fill_container", layout="horizontal",
                    justifyContent="space_between")
        text(top, "Label " + lab, lab, fontSize=12, fontWeight="650")
        text(top, "Percentual " + lab, f"{w}%", fontSize=12, fill="$muted")
        base = frame(r, "Barra base " + lab, width="fill_container", height=9,
                     fill="#EAECF0", cornerRadius=99, layout="none")
        rect(base, "Barra " + lab, x=0, y=0, width=w * 3, height=9, fill=col, cornerRadius=99)
    flt = frame(c, "Busca e filtros", x=0, y=504, width=1088, height=48,
                layout="horizontal", gap=12, alignItems="center")
    sb = frame(flt, "Buscar membro", width=320, height=44, fill="#FFFFFF",
               stroke="$line", strokeWidth=1, cornerRadius=12, layout="horizontal",
               gap=10, alignItems="center", padding=[0, 14])
    icon(sb, "search", "search", width=16, height=16)
    text(sb, "ph", "Pesquisar por membro...", fontSize=12, fill="$muted")
    for f in ["Período: janeiro", "Categoria: todas", "Status: aguardando"]:
        button(flt, f, False, h=44)
    table(c, ["Membro", "Data", "Categoria", "Valor", "Comprovante", "Status", "Conferente", "Ações"],
          [["Mariana Costa", "12/01", "Dízimo", "R$ 450,00", "comprovante.pdf",
            ("Aguardando", "wait"), "—", {"t": "Abrir", "href": T["tela5"]}],
           ["João Lima", "11/01", "Oferta", "R$ 200,00", "oferta-joao.jpg",
            ("Confirmada", "ok"), "Rute", {"t": "Abrir", "href": T["tela5"]}],
           ["Ana Souza", "10/01", "Missões", "R$ 150,00", "pix-ana.png",
            ("Necessita revisão", "rev"), "Rute", {"t": "Abrir", "href": T["tela5"]}],
           ["Carlos Nunes", "09/01", "Campanha", "R$ 500,00", "campanha-c.pdf",
            ("Confirmada", "ok"), "Rute", {"t": "Abrir", "href": T["tela5"]}],
           ["Bruno Castro", "08/01", "Evento", "R$ 90,00", "evento-b.png",
            ("Cancelada", "can"), "—", {"t": "Abrir", "href": T["tela5"]}],
           ["Helena Prado", "07/01", "Dízimo", "R$ 320,00", "helena-d.pdf",
            ("Aguardando", "wait"), "—", {"t": "Abrir", "href": T["tela5"]}],
           ["Pedro Alves", "06/01", "Dízimo", "R$ 600,00", "pedro.pdf",
            ("Confirmada", "ok"), "Rute", {"t": "Abrir", "href": T["tela5"]}]],
          0, 572, 1088, 296)

def tela5(c, T):
    detail = card(c, "Detalhe contribuição", 0, 0, 686, 838)
    head = frame(detail, "Header detalhe", width="fill_container",
                 layout="horizontal", justifyContent="space_between", alignItems="center")
    text(head, "Título detalhe", "Contribuição de Mariana Costa", fontSize=24, fontWeight="760")
    navText(head, "Voltar", "← Voltar para recebidas", T["tela4"], fontSize=12,
            fontWeight="650", fill="$primary")
    badge(detail, "Aguardando confirmação", "wait")
    for l, v in [["Valor", "R$ 450,00"], ["Data", "12/01/2026"], ["Categoria", "Dízimo"],
                 ["Observação", "Transferência via PIX após o culto de domingo."]]:
        r = frame(detail, "Info " + l, width="fill_container", layout="horizontal",
                  justifyContent="space_between", padding=[8, 0])
        text(r, "Label " + l, l, fontSize=13, fill="$muted")
        text(r, "Valor " + l, v, fontSize=14, fontWeight="650", textAlign="right",
             textGrowth="fixed-width", width=360)
    proof = frame(detail, "Comprovante", width="fill_container", height=240,
                  fill="#F9FAFB", stroke="$line", strokeWidth=1, cornerRadius=16,
                  layout="vertical", alignItems="center", justifyContent="center", gap=10)
    icon(proof, "Ícone comprovante", "file-text", width=48, height=48, fill="$primary")
    text(proof, "Nome comprovante", "comprovante-pix-jan.pdf", fontSize=14, fontWeight="700")
    text(proof, "Tam comprovante", "412 KB • pré-visualização", fontSize=12, fill="$muted")
    button(proof, "Abrir comprovante", False)
    acts = frame(detail, "Ações validação", width="fill_container",
                 layout="horizontal", gap=12)
    button(acts, "Confirmar contribuição", True)
    button(acts, "Solicitar revisão", False)
    button(acts, "Cancelar", False)
    hist = card(c, "Histórico alterações", 718, 0, 370, 838)
    bulletList(hist, ["12/01 21:08 • Mariana registrou a contribuição",
                      "12/01 21:09 • Comprovante anexado",
                      "13/01 08:14 • Aguardando conferência de Rute",
                      "Pendente • validar valor e comprovante"],
               title="Histórico de alterações")
    mem = frame(hist, "Membro box", width="fill_container", layout="horizontal",
                gap=10, alignItems="center", padding=[10, 0])
    a = frame(mem, "Avatar", width=38, height=38, cornerRadius=19, fill="#DDE5FF",
              layout="horizontal", alignItems="center", justifyContent="center")
    text(a, "MC", "MC", fontSize=13, fontWeight="700", fill="$primary")
    mi = frame(mem, "Info membro", layout="vertical", gap=2)
    text(mi, "Nome", "Mariana Costa", fontSize=13, fontWeight="650")
    text(mi, "Perfil", "Membro desde 2018 • Líder de célula", fontSize=11, fill="$muted")

def tela6(c, T):
    text(c, "Título escola", "Escola Bíblica", fontSize=30, fontWeight="760", x=0, y=0)
    est = frame(c, "Cards ensino", x=0, y=62, width=1088, height=112,
                layout="horizontal", gap=16)
    for it in [["Turmas ativas", "12", "2 iniciam este mês", "book-open"],
               ["Alunos matriculados", "326", "87% frequência média", "users"],
               ["Professores", "24", "4 em treinamento", "user-round-check"],
               ["Cursos", "18", "5 módulos novos", "library"],
               ["Próxima aula", "Qua 20h", "Doutrina Cristã", "calendar"]]:
        stat(est, *it)
    tabs = frame(c, "Tabs ensino", x=0, y=206, width=1088, height=48,
                 layout="horizontal", gap=8)
    for tb in ["Turmas", "Cursos", "Professores", "Alunos", "Aulas", "Materiais"]:
        button(tabs, tb, tb == "Turmas")
    turma = card(c, "Turmas em destaque", 0, 282, 1088, 556)
    text(turma, "Título turmas", "Turmas em destaque", fontSize=18, fontWeight="700")
    for t in [["Fundamentos da Fé", "Curso: Discipulado • Sala 3 • Dom 9h",
               "Professoras: Lúcia e Débora", "32 alunos • 92% frequência"],
              ["Panorama Bíblico", "Curso: Bíblia em um ano • Auditório • Qua 20h",
               "Professores: Rafael e Paulo", "48 alunos • 84% frequência"],
              ["Liderança Cristã", "Curso: Formação ministerial • Sáb 16h",
               "Professor: Pr. André", "22 alunos • 89% frequência"]]:
        row = frame(turma, "Turma " + t[0], width="fill_container", height=150,
                    fill="#F9FAFB", cornerRadius=14, layout="horizontal",
                    justifyContent="space_between", alignItems="center", padding=16)
        info = frame(row, "Info turma", layout="vertical", gap=6, width="fill_container")
        navText(info, "Nome turma", t[0], T["tela7"], fontSize=16, fontWeight="700")
        text(info, "Curso turma", t[1], fontSize=12, fill="$muted")
        text(info, "Prof turma", t[2], fontSize=12, fill="$muted")
        text(info, "Alunos turma", t[3], fontSize=12, fontWeight="650", fill="$primary")
        button(row, "Registrar presença", False, href=T["tela7"])

def tela7(c, T):
    dt = card(c, "Detalhe turma", 0, 0, 1088, 838)
    dhead = frame(dt, "Header turma", width="fill_container", layout="horizontal",
                  justifyContent="space_between", alignItems="center")
    tt = frame(dhead, "Título bloco", layout="vertical", gap=6)
    text(tt, "Nome turma", "Fundamentos da Fé", fontSize=28, fontWeight="760")
    text(tt, "Meta turma", "Curso: Discipulado • Sala 3 • Domingos às 9h • Professoras Lúcia e Débora",
         fontSize=13, fill="$muted")
    button(dhead, "Registrar presença", True)
    cols = frame(dt, "Resumo turma", width="fill_container", height=130,
                 layout="horizontal", gap=16)
    for it in [["Alunos", "32", "29 presentes na última aula", "users"],
               ["Frequência", "92%", "Acima da meta", "activity"],
               ["Próxima aula", "19 jan", "Oração e vida devocional", "calendar"],
               ["Materiais", "8", "2 novos arquivos", "paperclip"]]:
        stat(cols, *it)
    listb = frame(dt, "Conteúdo turma", width="fill_container", height=540,
                  layout="horizontal", gap=18)
    aulas = frame(listb, "Próximas aulas", width="fill_container", fill="#F9FAFB",
                  cornerRadius=16, layout="vertical", padding=18, gap=12)
    text(aulas, "Título aulas", "Próximas aulas", fontSize=17, fontWeight="700")
    for a in ["19/01 — Oração e vida devocional", "26/01 — Igreja e comunhão",
              "02/02 — Serviço cristão", "09/02 — Batismo e ceia"]:
        text(aulas, "Aula", a, fontSize=13, fill="#344054")
    alunos = frame(listb, "Lista alunos", width="fill_container", fill="#F9FAFB",
                   cornerRadius=16, layout="vertical", padding=18, gap=12)
    text(alunos, "Título alunos", "Alunos recentes", fontSize=17, fontWeight="700")
    for a in ["Mariana Costa • presente", "João Lima • presente",
              "Ana Souza • ausente justificado", "Daniel Pereira • presente",
              "Fernanda Alves • presente"]:
        text(alunos, "Aluno", a, fontSize=13, fill="#344054")

def tela8(c, T):
    eh = frame(c, "Header escalas", x=0, y=0, width=1088, layout="horizontal",
               justifyContent="space_between", alignItems="center")
    text(eh, "Título escalas", "Escalas dos ministérios", fontSize=30, fontWeight="760")
    button(eh, "Criar escala", True, href=T["tela9"])
    ev = frame(c, "Visualizações", x=0, y=70, width=1088, height=48,
               layout="horizontal", gap=8)
    for v in ["Calendário", "Lista", "Por ministério"]:
        button(ev, v, v == "Por ministério")
    board = frame(c, "Board escalas", x=0, y=146, width=1088, height=690,
                  layout="horizontal", gap=16)
    for min_, items in [["Louvor", ["Vocal: João Lima", "Vocal: Maria Rocha",
                                    "Guitarra: Pedro Alves", "Baixo: Lucas Moura",
                                    "Bateria: Marcos Reis"]],
                        ["Mídia", ["Projeção: Ana Souza", "Transmissão: Carlos Nunes",
                                   "Som: Felipe Duarte"]],
                        ["Recepção", ["Recepcionista: Fernanda Alves",
                                      "Boas-vindas: Helena Prado", "Apoio: Bruno Castro"]]]:
        col = frame(board, "Ministério " + min_, width="fill_container", fill="$surface",
                    stroke="$line", strokeWidth=1, cornerRadius=16,
                    layout="vertical", padding=18, gap=12)
        text(col, "Título " + min_, min_ + " • Domingo — Culto 19h", fontSize=16, fontWeight="700")
        for it in items:
            r = frame(col, "Escala " + it, width="fill_container", height=58,
                      fill="#F9FAFB", cornerRadius=12, layout="horizontal",
                      alignItems="center", justifyContent="space_between", padding=[0, 12])
            text(r, "Função", it, fontSize=13, fontWeight="600")
            if "Maria" in it: badge(r, "Convite enviado", "wait")
            elif "Lucas" in it: badge(r, "Substituição necessária", "rev")
            else: badge(r, "Confirmado", "ok")

def tela9(c, T):
    sc = card(c, "Criar escala", 150, 30, 790, 808)
    text(sc, "Título criar escala", "Criar escala", fontSize=28, fontWeight="760")
    for l, v in [["Culto/evento", "Domingo — Culto 19h"], ["Ministério", "Louvor"],
                 ["Função", "Vocal"], ["Membro", "Maria Rocha"],
                 ["Status inicial", "Convite enviado"]]:
        field(sc, l, v)
    prev = frame(sc, "Preview escala", width="fill_container", height=185,
                 fill="#F9FAFB", cornerRadius=16, layout="vertical", padding=18, gap=10)
    text(prev, "Título preview", "Prévia do convite", fontSize=16, fontWeight="700")
    text(prev, "Mensagem", "Maria Rocha será convidada para atuar como Vocal no ministério de Louvor no Domingo — Culto 19h. Ela poderá confirmar, recusar ou solicitar substituição.",
         fontSize=13, fill="$muted", textGrowth="fixed-width", width="fill_container")
    acts = frame(sc, "Ações criar escala", width="fill_container",
                 layout="horizontal", gap=12)
    button(acts, "Salvar e enviar convite", True, href=T["tela8"])
    button(acts, "Cancelar", False, href=T["tela8"])

def tela10(c, T):
    ah = frame(c, "Header agenda", x=0, y=0, width=1088, layout="horizontal",
               justifyContent="space_between", alignItems="center")
    text(ah, "Título agenda", "Agenda de cultos", fontSize=30, fontWeight="760")
    button(ah, "Novo culto/evento", True)
    cal = card(c, "Calendário mensal", 0, 72, 1088, 790)
    mh = frame(cal, "Header mês", width="fill_container", layout="horizontal",
               justifyContent="space_between", alignItems="center")
    icon(mh, "prev", "chevron-left", width=18, height=18)
    text(mh, "Mês", "Janeiro 2026", fontSize=17, fontWeight="700")
    icon(mh, "next", "chevron-right", width=18, height=18)
    week = frame(cal, "Dias semana", width="fill_container", height=34,
                 layout="horizontal", gap=8)
    for d in ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]:
        text(week, "Dia " + d, d, fontSize=12, fontWeight="700", fill="$muted",
             width="fill_container", textGrowth="fixed-width", textAlign="center")
    events = {4: ("Evento jovens", "wait"), 7: ("Culto 19h", "info"),
              11: ("Ensino 20h", "wait"), 14: ("Culto 19h", "info"),
              18: ("Ensino 20h", "wait"), 21: ("Culto 19h", "info"),
              25: ("Retiro casais", "wait"), 28: ("Culto 19h", "info")}
    for r_ in range(5):
        wr = frame(cal, "Semana " + str(r_), width="fill_container", height=122,
                   layout="horizontal", gap=8)
        for d in range(7):
            n = r_ * 7 + d + 1
            cell = frame(wr, "Dia " + str(n), width="fill_container",
                         height="fill_container", fill="#F9FAFB", cornerRadius=12,
                         layout="vertical", padding=10, gap=6)
            text(cell, "Número " + str(n), str(n), fontSize=12, fontWeight="700", fill="$muted")
            if n in events:
                lab, col = events[n]
                b = frame(cell, "Evento " + str(n), width="fill_container", height=30,
                          fill=BADGE[col][0], cornerRadius=8, layout="horizontal",
                          alignItems="center", padding=[0, 8])
                text(b, "Label evento", lab, fontSize=10, fontWeight="650",
                     fill=BADGE[col][1], href=T["tela11"])

def tela11(c, T):
    culto = card(c, "Detalhes culto", 0, 0, 1088, 838)
    chd = frame(culto, "Header culto", width="fill_container", layout="horizontal",
                justifyContent="space_between", alignItems="center")
    ct = frame(chd, "Texto culto", layout="vertical", gap=6)
    text(ct, "Título culto", "Culto de celebração", fontSize=28, fontWeight="760")
    text(ct, "Dados culto", "Domingo, 21 de janeiro • 19:00 • Templo principal • Responsável: Pr. André",
         fontSize=13, fill="$muted")
    acts = frame(chd, "Ações culto", layout="horizontal", gap=10, alignItems="center")
    badge(acts, "Programado", "info")
    button(acts, "Editar culto", False)
    cc = frame(culto, "Corpo culto", width="fill_container", height=660,
               layout="horizontal", gap=18)
    prog = frame(cc, "Programação", width="fill_container", fill="#F9FAFB",
                 cornerRadius=16, layout="vertical", padding=18, gap=12)
    text(prog, "Título programação", "Programação", fontSize=18, fontWeight="700")
    for p in ["19:00 — Boas-vindas", "19:10 — Louvor", "19:40 — Avisos",
              "19:50 — Pregação", "20:40 — Encerramento"]:
        text(prog, "Item programação", p, fontSize=14, fill="#344054")
    inv = frame(cc, "Ministérios envolvidos", width="fill_container", fill="#F9FAFB",
                cornerRadius=16, layout="vertical", padding=18, gap=12)
    text(inv, "Título envolvidos", "Ministérios e escala", fontSize=18, fontWeight="700")
    for p in ["Louvor • 5 escalados • 4 confirmados", "Mídia • 3 escalados • todos confirmados",
              "Recepção • 3 escalados • 1 convite pendente", "Intercessão • 2 escalados"]:
        text(inv, "Item ministério", p, fontSize=14, fill="#344054")
    notes = frame(cc, "Observações", width="fill_container", fill="#F9FAFB",
                  cornerRadius=16, layout="vertical", padding=18, gap=12)
    text(notes, "Título obs", "Observações", fontSize=18, fontWeight="700")
    text(notes, "Texto obs", "Preparar ceia, revisar microfones às 18h30 e reservar primeira fileira para visitantes. Incluir aviso da campanha missionária.",
         fontSize=14, fill="#344054", textGrowth="fixed-width", width="fill_container")

def tela12(c, T):
    prof = card(c, "Perfil membro", 0, 0, 1088, 838)
    ph = frame(prof, "Header perfil", width="fill_container", layout="horizontal",
               gap=18, alignItems="center")
    pav = frame(ph, "Avatar grande", width=78, height=78, cornerRadius=39,
                fill="#DDE5FF", layout="horizontal", alignItems="center",
                justifyContent="center")
    text(pav, "Iniciais perfil", "MC", fontSize=24, fontWeight="800", fill="$primary")
    pi = frame(ph, "Info perfil", layout="vertical", gap=6, width="fill_container")
    text(pi, "Nome perfil", "Mariana Costa", fontSize=28, fontWeight="760")
    text(pi, "Detalhes perfil", "Membro desde 2018 • Líder de célula • Perfil: Membro",
         fontSize=13, fill="$muted")
    button(ph, "Editar perfil", False)
    pstats = frame(prof, "Resumo perfil", width="fill_container", height=112,
                   layout="horizontal", gap=16)
    for it in [["Contribuições ano", "R$ 8.740", "12 registros", "wallet"],
               ["Escalas", "8", "6 confirmadas", "calendar-check"],
               ["Turmas", "2", "Fundamentos e Liderança", "book-open"],
               ["Aniversário", "14 maio", "Contato atualizado", "cake"]]:
        stat(pstats, *it)
    pc = frame(prof, "Colunas perfil", width="fill_container", height=520,
               layout="horizontal", gap=18)
    for title, items in [["Dados pessoais", ["E-mail: mariana@exemplo.com",
                                             "Telefone: (11) 99999-0145", "Família: Costa",
                                             "Endereço: Vila Mariana, São Paulo"]],
                         ["Últimas contribuições", ["12/01 • Dízimo • R$ 450 • Aguardando",
                                                    "08/01 • Missões • R$ 120 • Confirmada",
                                                    "22/12 • Oferta • R$ 80 • Confirmada"]],
                         ["Participação", ["Ministério: Recepção",
                                           "Turma: Fundamentos da Fé",
                                           "Próxima escala: Dom 19h",
                                           "Última presença: 12/01"]]]:
        box = frame(pc, title, width="fill_container", fill="#F9FAFB", cornerRadius=16,
                    layout="vertical", padding=18, gap=12)
        text(box, "Título " + title, title, fontSize=18, fontWeight="700")
        for it in items:
            if "contribui" in title and "•" in it:
                b = frame(box, "Link " + it, width="fill_container",
                          layout="horizontal", gap=10, alignItems="center")
                text(b, "Item", it, fontSize=13, fill="#344054",
                     textGrowth="fixed-width", width="fill_container")
                navText(b, "Abrir", "Ver", T["tela5"], fontSize=12, fontWeight="650",
                        fill="$primary")
            else:
                text(box, "Item " + it, it, fontSize=13, fill="#344054")

def tela13(c, T):
    ah = frame(c, "Header avisos", x=0, y=0, width=1088, layout="horizontal",
               justifyContent="space_between", alignItems="center")
    ht = frame(ah, "Texto header", layout="vertical", gap=6)
    text(ht, "Título avisos", "Avisos e notificações", fontSize=30, fontWeight="760")
    text(ht, "Subtexto", "Publique comunicados para membros, equipes e leaders.",
         fontSize=14, fill="$muted")
    button(ah, "+ Novo aviso", True)
    dest = card(c, "Aviso em destaque", 0, 110, 704, 200)
    top = frame(dest, "Topo destaque", width="fill_container", layout="horizontal",
                justifyContent="space_between", alignItems="center")
    text(top, "Título destaque", "Campanha Missionária — envio de R$ 12.000",
         fontSize=17, fontWeight="700")
    badge(top, "Fixado no topo", "rev")
    text(dest, "Corpo destaque", "Convidamos toda a igreja a participar do culto de envio da equipe missionária neste sábado, 18h, no templo principal. Ofertas podem ser registradas pelo app na categoria Missões.",
         fontSize=13, fill="#344054", textGrowth="fixed-width", width="fill_container")
    meta = frame(dest, "Meta destaque", width="fill_container", layout="horizontal",
                 gap=14, alignItems="center")
    text(meta, "Público", "Público: todos os membros • Canal: push + e-mail",
         fontSize=11, fill="$muted")
    text(meta, "Enviado", "Enviado há 2 h • 812 visualizações", fontSize=11, fill="$muted")
    side = card(c, "Agendados", 728, 110, 360, 200)
    bulletList(side, ["Retiro de casais — 08/02 08:00", "Ensaio louvor — Qui 20h",
                      "Reunião líderes — Seg 19:30"], title="Próximos envios agendados")
    table(c, ["Título", "Público", "Canal", "Envio", "Status"],
          [["Escalas atualizadas de janeiro", "Ministérios", "Push", "12/01 18:40", ("Publicado", "ok")],
           ["Aulas da EB retomadas dia 19", "Alunos e professores", "E-mail", "12/01 16:00", ("Publicado", "ok")],
           ["Lanche pós-culto de jovens", "Jovens", "Push", "—", ("Rascunho", "wait")],
           ["Manutenção do estacionamento", "Todos", "SMS", "—", ("Agendado", "info")]],
          0, 340, 1088, 300)
    leg = frame(c, "Legenda", x=0, y=664, width=1088, layout="horizontal", gap=10)
    for lab, col in [("Publicado", "ok"), ("Rascunho", "wait"), ("Agendado", "info")]:
        badge(leg, lab, col)

# ---------------------------------------------------------------- montagem

SCREENS = [
    ("Dashboard geral", "Dashboard", tela1, "tela1"),
    ("Minhas contribuições", "Minhas contribuições", tela2, "tela2"),
    ("Registrar contribuição", "Minhas contribuições", tela3, "tela3"),
    ("Gestão financeira", "Contribuições recebidas", tela4, "tela4"),
    ("Detalhe de contribuição", "Contribuições recebidas", tela5, "tela5"),
    ("Escola Bíblica", "Escola Bíblica", tela6, "tela6"),
    ("Detalhe da turma", "Turmas", tela7, "tela7"),
    ("Escalas dos ministérios", "Escalas", tela8, "tela8"),
    ("Criar escala", "Escalas", tela9, "tela9"),
    ("Agenda de cultos", "Agenda", tela10, "tela10"),
    ("Detalhes do culto", "Cultos", tela11, "tela11"),
    ("Perfil do membro", "Membros", tela12, "tela12"),
    ("Avisos", "Avisos", tela13, "tela13"),
]

def main():
    doc = {"version": "2.17",
           "variables": {k: {"type": "color", "value": v} for k, v in COLOR_VARS.items()}}
    doc["variables"]["font"] = {"type": "string", "value": "Inter"}
    T = {}  # chave -> id da tela
    screens = []
    for i, (name, active, fn, key) in enumerate(SCREENS):
        x, y = (i % 3) * (W + 80), (i // 3) * (H + 80)
        s = frame(doc, name, x=x, y=y, width=W, height=H, fill="$bg", clip=True,
                  layout="none")
        T[key] = s["id"]
        screens.append((name, active, fn, s))
    for name, active, fn, s in screens:
        build_sidebar(s, active)
        build_topbar(s, name)
        c = content(s)
        if fn is tela1:
            fn(c)
        else:
            fn(c, T)
    # links da sidebar -> telas
    for t, key in LINKS:
        t["href"] = T.get(key, key)
    out = "design/moriah_mockup.pen"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    # validação
    chk = json.load(open(out, encoding="utf-8"))
    ids = set()
    def walk(n):
        ids.add(n["id"])
        for c in n.get("children", []): walk(c)
    for c in chk["children"]: walk(c)
    hrefs = []
    def walk2(n):
        if "href" in n: hrefs.append(n["href"])
        for c in n.get("children", []): walk2(c)
    for c in chk["children"]: walk2(c)
    bad = [h for h in hrefs if h not in ids]
    assert not bad, f"href quebrado: {bad}"
    assert all("/" not in i for i in ids)
    print(f"OK: {out}")
    print(f"telas={len(chk['children'])} nodes={len(ids)} links_href={len(hrefs)} ok={len(set(hrefs))} destinos")

if __name__ == "__main__":
    main()
