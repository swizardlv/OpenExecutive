#!/usr/bin/env python3
"""
Automated i18n migration script.
Extracts `isZh ? zh : en` ternary patterns into `locales/zh.ts` and `locales/en.ts`,
replacing call sites with `t("key")` or `t("key", { params })`.
"""

import json
import os
import re
import sys

ZH_PATH = "packages/ui/src/locales/zh.ts"
EN_PATH = "packages/ui/src/locales/en.ts"

def load_dict(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    entries = {}
    for line in content.splitlines():
        line = line.strip()
        m = re.match(r'^"([^"]+)":\s*(.*?),?$', line)
        if m:
            key = m.group(1)
            val_str = m.group(2).rstrip(',')
            try:
                val = json.loads(val_str)
            except Exception:
                if val_str.startswith('"') and val_str.endswith('"'):
                    val = val_str[1:-1].replace('\\"', '"')
                else:
                    val = val_str
            entries[key] = val
    return entries

def slugify(text, max_words=5):
    # Strip symbols, keep alphanumeric and underscores
    cleaned = re.sub(r'[^a-zA-Z0-9\s_]', '', text)
    words = [w.lower() for w in cleaned.split() if w][:max_words]
    return "_".join(words) or "msg"

def save_dicts(zh_dict, en_dict):
    for filename, entries, is_zh in [
        (ZH_PATH, zh_dict, True),
        (EN_PATH, en_dict, False),
    ]:
        dict_name = "zh" if is_zh else "en"
        header = (
            "// Primary locale dictionary: Chinese (zh)\n// Default language for Open Executive\n"
            if is_zh
            else "// English locale dictionary (en)\n"
        )
        lines = [header, f"export const {dict_name}: Record<string, string> = {{"]
        for k in sorted(entries.keys()):
            val_json = json.dumps(entries[k], ensure_ascii=False)
            key_json = json.dumps(k)
            lines.append(f"  {key_json}: {val_json},")
        lines.append("};\n")

        with open(filename, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

def get_namespace(filepath):
    rel = os.path.relpath(filepath, "packages/ui/src")
    parts = rel.replace(".tsx", "").replace(".ts", "").split(os.sep)
    parts = [
        p.replace("[", "").replace("]", "").replace("-", "_")
        for p in parts
        if p not in ("app", "components")
    ]
    return ".".join(parts)

def parse_template_literal(text):
    inner = text[1:-1]
    vars_found = []

    def repl(m):
        expr = m.group(1).strip()
        var_name = re.sub(r'[^a-zA-Z0-9_]', '_', expr).strip('_')
        if not var_name:
            var_name = "val"
        vars_found.append((var_name, expr))
        return "{" + var_name + "}"

    clean_template = re.sub(r'\$\{([^}]+)\}', repl, inner)
    return clean_template, vars_found

def process_file(filepath, dry_run=False):
    zh_dict = load_dict(ZH_PATH)
    en_dict = load_dict(EN_PATH)
    ns = get_namespace(filepath)

    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Pattern: (isZh | locale === "zh") ? (zh_str) : (en_str)
    STR_REGEX = r'(?:\"(?:[^\"\\]|\\.)*\"|\'(?:[^\'\\]|\\.)*\'|`[^`]*`)'
    pattern = re.compile(
        r'(?:isZh|\blocale === "zh")\s*\?\s*(' + STR_REGEX + r')\s*:\s*(' + STR_REGEX + r')'
    )

    matches = list(pattern.finditer(content))
    if not matches:
        return 0

    print(f"Processing {filepath}: found {len(matches)} matches")

    new_content = content
    added_keys = 0

    for m in reversed(matches):
        zh_raw = m.group(1).strip()
        en_raw = m.group(2).strip()

        if zh_raw.startswith('`') or en_raw.startswith('`'):
            zh_clean, zh_vars = (
                parse_template_literal(zh_raw)
                if zh_raw.startswith('`')
                else (zh_raw[1:-1], [])
            )
            en_clean, en_vars = (
                parse_template_literal(en_raw)
                if en_raw.startswith('`')
                else (en_raw[1:-1], [])
            )
            vars_dict = {}
            for vname, expr in en_vars:
                vars_dict[vname] = expr
            for vname, expr in zh_vars:
                if vname not in vars_dict:
                    vars_dict[vname] = expr

            base_slug = slugify(en_clean)
            key = f"{ns}.{base_slug}"
            idx = 1
            while key in en_dict and en_dict[key] != en_clean:
                idx += 1
                key = f"{ns}.{base_slug}_{idx}"

            zh_dict[key] = zh_clean
            en_dict[key] = en_clean
            added_keys += 1

            if vars_dict:
                args = ", ".join(
                    f"{v}: {e}" if v != e else v for v, e in vars_dict.items()
                )
                replacement = f't("{key}", {{ {args} }})'
            else:
                replacement = f't("{key}")'
        else:
            try:
                zh_str = json.loads(zh_raw) if zh_raw.startswith('"') else zh_raw[1:-1]
            except Exception:
                zh_str = zh_raw[1:-1]
            try:
                en_str = json.loads(en_raw) if en_raw.startswith('"') else en_raw[1:-1]
            except Exception:
                en_str = en_raw[1:-1]

            base_slug = slugify(en_str)
            key = f"{ns}.{base_slug}"
            idx = 1
            while key in en_dict and en_dict[key] != en_str:
                idx += 1
                key = f"{ns}.{base_slug}_{idx}"

            zh_dict[key] = zh_str
            en_dict[key] = en_str
            added_keys += 1

            replacement = f't("{key}")'

        start, end = m.span()
        new_content = new_content[:start] + replacement + new_content[end:]

    # Ensure useI18n and t are imported and hooked in the file
    if "useI18n" not in new_content:
        new_content = 'import { useI18n } from "@/lib/i18n";\n' + new_content

    # Ensure t is extracted from useI18n()
    new_content = re.sub(
        r'const\s*\{\s*locale\s*\}\s*=\s*useI18n\(\);',
        'const { locale, t } = useI18n();',
        new_content,
    )

    # If isZh is no longer used, remove its declaration
    content_without_decl = re.sub(
        r'\s*const isZh = locale === "zh";?\n?', '\n', new_content
    )
    if "isZh" not in content_without_decl:
        new_content = content_without_decl

    if not dry_run:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        save_dicts(zh_dict, en_dict)
        print(f"Saved {filepath} with {added_keys} new keys.")
    return added_keys

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 migrate_i18n.py <file_or_dir> ...")
        sys.exit(1)
    targets = sys.argv[1:]
    total_added = 0
    for target in targets:
        if os.path.isfile(target):
            total_added += process_file(target) or 0
        elif os.path.isdir(target):
            for root, _, files in os.walk(target):
                for file in sorted(files):
                    if file.endswith((".tsx", ".ts")) and "locales" not in root:
                        p = os.path.join(root, file)
                        total_added += process_file(p) or 0
    print(f"Total keys processed: {total_added}")
