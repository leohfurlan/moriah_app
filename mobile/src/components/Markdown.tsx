import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme";

type Block = { kind: "heading" | "paragraph" | "bullet" | "ordered" | "quote" | "code" | "rule"; text: string; level?: number; marker?: string };

function parseBlocks(value: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let code: string[] | null = null;
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: "paragraph", text: paragraph.join("\n") });
      paragraph = [];
    }
  };

  value.split(/\r?\n/).forEach((line) => {
    if (line.trim().startsWith("```")) {
      if (code) {
        blocks.push({ kind: "code", text: code.join("\n") });
        code = null;
      } else {
        flushParagraph();
        code = [];
      }
      return;
    }
    if (code) {
      code.push(line);
      return;
    }
    if (!line.trim()) {
      flushParagraph();
      return;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
      return;
    }
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      flushParagraph();
      blocks.push({ kind: "rule", text: "" });
      return;
    }
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      blocks.push({ kind: "bullet", marker: "•", text: bullet[1] });
      return;
    }
    const ordered = line.match(/^\s*(\d+)\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      blocks.push({ kind: "ordered", marker: `${ordered[1]}.`, text: ordered[2] });
      return;
    }
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      blocks.push({ kind: "quote", text: quote[1] });
      return;
    }
    paragraph.push(line);
  });
  if (code !== null) blocks.push({ kind: "code", text: (code as string[]).join("\n") });
  flushParagraph();
  return blocks;
}

function inline(value: string): ReactNode[] {
  const tokens = value.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^\)]+\))/g).filter(Boolean);
  return tokens.map((token, index) => {
    if ((token.startsWith("**") && token.endsWith("**")) || (token.startsWith("__") && token.endsWith("__"))) {
      return <Text key={index} style={styles.bold}>{token.slice(2, -2)}</Text>;
    }
    if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) {
      return <Text key={index} style={styles.italic}>{token.slice(1, -1)}</Text>;
    }
    if (token.startsWith("`") && token.endsWith("`")) {
      return <Text key={index} style={styles.inlineCode}>{token.slice(1, -1)}</Text>;
    }
    const link = token.match(/^\[([^\]]+)\]\([^\)]+\)$/);
    if (link) return <Text key={index} style={styles.link}>{link[1]}</Text>;
    return <Text key={index}>{token}</Text>;
  });
}

export function MarkdownView({ value }: { value: string }) {
  return (
    <View style={styles.container}>
      {parseBlocks(value).map((block, index) => {
        if (block.kind === "rule") return <View key={index} style={styles.rule} />;
        if (block.kind === "heading") return <Text key={index} style={[styles.heading, block.level === 1 && styles.headingOne, block.level === 2 && styles.headingTwo]}>{inline(block.text)}</Text>;
        if (block.kind === "bullet" || block.kind === "ordered") return <View key={index} style={styles.listRow}><Text style={styles.marker}>{block.marker}</Text><Text style={styles.body}>{inline(block.text)}</Text></View>;
        if (block.kind === "quote") return <View key={index} style={styles.quote}><Text style={styles.body}>{inline(block.text)}</Text></View>;
        if (block.kind === "code") return <Text key={index} selectable style={styles.code}>{block.text}</Text>;
        return <Text key={index} selectable style={styles.body}>{inline(block.text)}</Text>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  body: { color: colors.inkBody, fontSize: 15, lineHeight: 24 },
  heading: { color: colors.ink, fontSize: 18, lineHeight: 25, fontWeight: "800" },
  headingOne: { fontSize: 24, lineHeight: 30 },
  headingTwo: { fontSize: 20, lineHeight: 27 },
  bold: { fontWeight: "800" },
  italic: { fontStyle: "italic" },
  inlineCode: { fontFamily: "monospace", backgroundColor: colors.surfaceSelected, color: colors.accent },
  link: { color: colors.accent, textDecorationLine: "underline" },
  listRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  marker: { width: 22, color: colors.accent, fontSize: 15, lineHeight: 24, fontWeight: "800" },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.accent, paddingLeft: 12 },
  code: { color: colors.inkBody, backgroundColor: "#F2F4F7", borderRadius: 8, padding: 12, fontFamily: "monospace", fontSize: 13, lineHeight: 20 },
  rule: { height: 1, backgroundColor: colors.borderDivider },
});
