import {
  StreamLanguage,
  type StreamParser,
} from "@codemirror/language";
import { LanguageSupport } from "@codemirror/language";
import { tags } from "@lezer/highlight";

interface State {
  /** Inside {{ ... }} output tag */
  inOutput: boolean;
  /** Inside {% ... %} control tag */
  inTag: boolean;
}

const liquidParser: StreamParser<State> = {
  startState(): State {
    return { inOutput: false, inTag: false };
  },

  token(stream, state): string | null {
    // Inside {{ ... }} output expression
    if (state.inOutput) {
      if (stream.match("}}")) {
        state.inOutput = false;
        return "brace";
      }
      if (stream.eatSpace()) return null;

      // Filter pipe
      if (stream.match("|")) return "keyword";

      // Filter names after pipe
      if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_]*/)) {
        return "variableName";
      }

      // Quoted strings
      if (stream.match(/^"[^"]*"/) || stream.match(/^'[^']*'/)) {
        return "string";
      }

      // Numbers
      if (stream.match(/^\d+(\.\d+)?/)) return "variableName";

      stream.next();
      return null;
    }

    // Inside {% ... %} control tag
    if (state.inTag) {
      if (stream.match("%}")) {
        state.inTag = false;
        return "brace";
      }
      if (stream.eatSpace()) return null;

      // Keywords
      if (
        stream.match(
          /^(?:if|elsif|else|endif|for|endfor|unless|endunless|include|comment|endcomment|assign|capture|endcapture|in)\b/
        )
      ) {
        return "keyword";
      }

      // Quoted strings
      if (stream.match(/^"[^"]*"/) || stream.match(/^'[^']*'/)) {
        return "string";
      }

      // Variable names (dotted paths like foo.bar.baz)
      if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_./-]*/)) {
        return "variableName";
      }

      // Operators
      if (stream.match(/^(?:==|!=|<=|>=|<|>|and|or|not|contains)\b/)) {
        return "keyword";
      }

      stream.next();
      return null;
    }

    // Outside: look for opening delimiters
    if (stream.match("{{")) {
      state.inOutput = true;
      return "brace";
    }
    if (stream.match("{%")) {
      state.inTag = true;
      return "brace";
    }

    // Consume plain text until next `{` or end of line
    while (stream.next() != null) {
      if (stream.peek() === "{") break;
    }
    return null;
  },

  tokenTable: {
    brace: tags.brace,
    keyword: tags.keyword,
    string: tags.string,
    variableName: tags.variableName,
  },
};

const liquidLang = StreamLanguage.define(liquidParser);

export function liquid(): LanguageSupport {
  return new LanguageSupport(liquidLang);
}
