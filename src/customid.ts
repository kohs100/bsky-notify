interface CSig<CName extends string> {
  readonly parent?: CSig<any>;
  readonly cname: CName;
  readonly subcommands: readonly CSig<any>[];

  parse(cid: string, ofs: number): C | "invalid" | "nonterminal";
  rbuild(inner?: C): C;
  toString(): string;

  new (cname: CName, inner?: C): C;
}

abstract class C {
  static readonly parent?: CSig<any>;
  static readonly cname: string;
  static readonly subcommands: readonly CSig<any>[] = [];

  constructor(
    public readonly cname: string,
    public readonly inner?: C
  ) {}

  toString(is_root: boolean = true): string {
    const prefix = (is_root ? "" : "-") + this.cname;

    const sel = this.inner;
    if (sel) {
      return prefix + sel.toString(false);
    } else {
      return prefix;
    }
  }
}

function MixinC<Parent extends CSig<any>, CName extends string>(
  cname: CName,
  parent?: Parent
) {
  abstract class Derived extends C {
    static readonly parent?: Parent = parent;
    static readonly cname: CName = cname;

    static rbuild(inner?: C): C {
      const newthis = this as unknown as CSig<CName>;
      const leaf = new newthis(this.cname, inner);
      const parent = this.parent;

      if (parent) {
        return this.parent.rbuild(leaf);
      } else {
        return leaf;
      }
    }

    static build(): CustomID {
      const res = this.rbuild();
      return new CustomID(res);
    }

    static parse(cid: string, ofs: number = 0): C | "invalid" | "nonterminal" {
      console.log("Parsing from", this.name);
      const nxt = cid.indexOf("-", ofs);

      const newthis = this as unknown as CSig<CName>;
      const cur_cname = nxt < 0 ? cid.slice(ofs) : cid.slice(ofs, nxt);
      if (this.cname !== cur_cname) return "invalid";

      if (nxt < 0) {
        return this.subcommands.length > 0
          ? "nonterminal"
          : new newthis(this.cname);
      }

      for (const sc of this.subcommands) {
        const res = sc.parse(cid, nxt + 1);
        if (res === "invalid") {
          continue;
        } else if (res === "nonterminal") {
          return res;
        } else {
          return new newthis(this.cname, res);
        }
      }

      return "invalid";
    }
  }

  return Derived;
}

export class CustomID {
  static readonly btn = class extends MixinC("btn") {
    static readonly bsky = class extends MixinC("bsky", this) {
      static readonly like = class extends MixinC("like", this) {};
      static readonly repost = class extends MixinC("repost", this) {};
      static readonly subcommands: readonly CSig<"like" | "repost">[] = [
        this.like,
        this.repost,
      ] as const;
    };
    static readonly trans = class extends MixinC("trans", this) {};
    static readonly subcommands: readonly CSig<"trans" | "bsky">[] = [
      this.bsky,
      this.trans,
    ] as const;
  };
  static readonly commands: readonly CSig<"btn">[] = [this.btn];

  public readonly tokens: string[];
  constructor(public readonly inner: C) {
    this.tokens = (() => {
      let tokens: string[] = [];
      let i: C | undefined = inner;
      while (i) {
        tokens.push(i.cname);
        i = i.inner;
      }
      return tokens;
    })();
  }

  toString(): string {
    return this.inner.toString(true);
  }

  static parse(cid: string): CustomID {
    for (const sc of this.commands) {
      const res = sc.parse(cid, 0);

      if (res === "invalid") {
        continue;
      } else if (res === "nonterminal") {
        throw new Error(`Invalid customID: ${cid}`);
      } else {
        return new this(res);
      }
    }
    throw new Error(`Invalid customID: ${cid}`);
  }
}
