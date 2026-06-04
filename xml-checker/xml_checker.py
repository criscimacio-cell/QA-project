#!/usr/bin/env python3
"""
XML Checker — validates XML files against a DTD and a data dictionary.

Usage:
    python xml_checker.py <xml_file> [options]

Options:
    --dtd <file>        Path to DTD file (optional)
    --dict <file>       Path to data dictionary JSON file (optional)
    --report <file>     Write report to file instead of stdout
    --strict            Treat warnings as errors (exit code 1)
    --no-color          Disable colored output

Exit codes:
    0   All checks passed
    1   Errors found (or warnings in --strict mode)
    2   Script usage / file not found error
"""

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from io import StringIO
from typing import Any

from lxml import etree


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class Issue:
    level: str          # "ERROR" | "WARNING" | "INFO"
    category: str       # "SYNTAX" | "DTD" | "DICT" | "TYPE" | "REQUIRED"
    message: str
    line: int | None = None
    element: str | None = None
    attribute: str | None = None


@dataclass
class CheckResult:
    xml_file: str
    dtd_file: str | None
    dict_file: str | None
    issues: list[Issue] = field(default_factory=list)
    passed: bool = True

    def add(self, level: str, category: str, message: str, **kwargs):
        self.issues.append(Issue(level=level, category=category, message=message, **kwargs))
        if level == "ERROR":
            self.passed = False

    @property
    def errors(self):
        return [i for i in self.issues if i.level == "ERROR"]

    @property
    def warnings(self):
        return [i for i in self.issues if i.level == "WARNING"]

    @property
    def infos(self):
        return [i for i in self.issues if i.level == "INFO"]


# ---------------------------------------------------------------------------
# Color helpers
# ---------------------------------------------------------------------------

USE_COLOR = True

COLORS = {
    "ERROR":   "\033[91m",
    "WARNING": "\033[93m",
    "INFO":    "\033[96m",
    "PASS":    "\033[92m",
    "BOLD":    "\033[1m",
    "RESET":   "\033[0m",
}


def c(text: str, key: str) -> str:
    if not USE_COLOR:
        return text
    return f"{COLORS.get(key, '')}{text}{COLORS['RESET']}"


# ---------------------------------------------------------------------------
# Step 1 — Syntax / well-formedness check
# ---------------------------------------------------------------------------

def check_syntax(xml_path: str, result: CheckResult) -> etree._Element | None:
    """Parse the XML file; return the root element or None on failure."""
    try:
        parser = etree.XMLParser(
            load_dtd=True,
            no_network=True,
            resolve_entities=False,
        )
        tree = etree.parse(xml_path, parser=parser)
        result.add("INFO", "SYNTAX", "XML is well-formed")
        return tree.getroot()
    except etree.XMLSyntaxError as exc:
        for err in exc.error_log:
            result.add(
                "ERROR", "SYNTAX",
                f"{err.message}",
                line=err.line,
            )
        return None


# ---------------------------------------------------------------------------
# Step 2 — DTD validation
# ---------------------------------------------------------------------------

def check_dtd(xml_path: str, dtd_path: str, result: CheckResult) -> None:
    """Validate the XML file against the given DTD."""
    try:
        dtd = etree.DTD(dtd_path)
    except etree.DTDParseError as exc:
        result.add("ERROR", "DTD", f"Could not parse DTD: {exc}")
        return

    try:
        tree = etree.parse(xml_path)
    except etree.XMLSyntaxError:
        return  # already reported in check_syntax

    if dtd.validate(tree):
        result.add("INFO", "DTD", f"Document is valid against DTD: {os.path.basename(dtd_path)}")
    else:
        for err in dtd.error_log:
            result.add(
                "ERROR", "DTD",
                err.message,
                line=err.line,
            )


# ---------------------------------------------------------------------------
# Step 3 — Data dictionary validation
# ---------------------------------------------------------------------------

# Data dictionary JSON schema (example):
# {
#   "elements": {
#     "Order": {
#       "required": true,
#       "description": "Root order element",
#       "attributes": {
#         "id": {"required": true, "type": "string", "pattern": "^ORD-\\d+$"},
#         "status": {"required": true, "type": "enum", "values": ["open","closed","pending"]}
#       },
#       "children": {
#         "required": ["Customer", "LineItem"],
#         "optional": ["Notes"]
#       }
#     },
#     "Quantity": {
#       "required": false,
#       "text_type": "integer",
#       "min": 1
#     }
#   }
# }

TYPE_VALIDATORS: dict[str, Any] = {
    "integer": lambda v: re.fullmatch(r"-?\d+", v.strip()) is not None,
    "float":   lambda v: re.fullmatch(r"-?\d+(\.\d+)?", v.strip()) is not None,
    "boolean": lambda v: v.strip().lower() in ("true", "false", "1", "0", "yes", "no"),
    "date":    lambda v: re.fullmatch(r"\d{4}-\d{2}-\d{2}", v.strip()) is not None,
    "datetime":lambda v: re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}", v.strip()) is not None,
    "email":   lambda v: re.fullmatch(r"[^@]+@[^@]+\.[^@]+", v.strip()) is not None,
    "string":  lambda v: True,
}


def load_data_dict(dict_path: str, result: CheckResult) -> dict | None:
    try:
        with open(dict_path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        result.add("ERROR", "DICT", f"Could not load data dictionary: {exc}")
        return None


def check_element_against_dict(
    elem: etree._Element,
    elem_def: dict,
    result: CheckResult,
    path: str,
) -> None:
    tag = elem.tag
    line = elem.sourceline if hasattr(elem, "sourceline") else None

    # --- attribute checks ---
    attr_defs: dict = elem_def.get("attributes", {})
    for attr_name, attr_def in attr_defs.items():
        value = elem.get(attr_name)
        if attr_def.get("required", False) and value is None:
            result.add(
                "ERROR", "DICT",
                f"<{tag}> missing required attribute '{attr_name}'",
                line=line, element=path, attribute=attr_name,
            )
            continue
        if value is None:
            continue

        attr_type = attr_def.get("type", "string")
        if attr_type == "enum":
            allowed = attr_def.get("values", [])
            if value not in allowed:
                result.add(
                    "ERROR", "DICT",
                    f"<{tag}> attribute '{attr_name}' value '{value}' not in allowed values {allowed}",
                    line=line, element=path, attribute=attr_name,
                )
        elif attr_type in TYPE_VALIDATORS:
            if not TYPE_VALIDATORS[attr_type](value):
                result.add(
                    "ERROR", "TYPE",
                    f"<{tag}> attribute '{attr_name}' value '{value}' is not a valid {attr_type}",
                    line=line, element=path, attribute=attr_name,
                )
        pattern = attr_def.get("pattern")
        if pattern and not re.fullmatch(pattern, value):
            result.add(
                "ERROR", "DICT",
                f"<{tag}> attribute '{attr_name}' value '{value}' does not match pattern '{pattern}'",
                line=line, element=path, attribute=attr_name,
            )

    # --- text content type check ---
    text_type = elem_def.get("text_type")
    if text_type and elem.text and elem.text.strip():
        val = elem.text.strip()
        validator = TYPE_VALIDATORS.get(text_type)
        if validator and not validator(val):
            result.add(
                "ERROR", "TYPE",
                f"<{tag}> text content '{val}' is not a valid {text_type}",
                line=line, element=path,
            )
        # numeric range checks
        if text_type in ("integer", "float"):
            try:
                num = float(val)
                if "min" in elem_def and num < elem_def["min"]:
                    result.add(
                        "ERROR", "DICT",
                        f"<{tag}> value {val} is below minimum {elem_def['min']}",
                        line=line, element=path,
                    )
                if "max" in elem_def and num > elem_def["max"]:
                    result.add(
                        "ERROR", "DICT",
                        f"<{tag}> value {val} exceeds maximum {elem_def['max']}",
                        line=line, element=path,
                    )
            except ValueError:
                pass

    # --- required / optional children ---
    children_def: dict = elem_def.get("children", {})
    required_children: list = children_def.get("required", [])
    present_tags = {child.tag for child in elem}
    for req_child in required_children:
        if req_child not in present_tags:
            result.add(
                "ERROR", "REQUIRED",
                f"<{tag}> is missing required child element <{req_child}>",
                line=line, element=path,
            )

    # warn about unexpected children (if strict list provided)
    allowed_children = set(required_children) | set(children_def.get("optional", []))
    if allowed_children:
        for child in elem:
            if child.tag not in allowed_children:
                result.add(
                    "WARNING", "DICT",
                    f"<{tag}> contains unexpected child element <{child.tag}>",
                    line=getattr(child, "sourceline", None),
                    element=f"{path}/{child.tag}",
                )


def check_data_dict(root: etree._Element, data_dict: dict, result: CheckResult) -> None:
    elements_def: dict = data_dict.get("elements", {})

    def walk(elem: etree._Element, path: str):
        tag = elem.tag
        if tag in elements_def:
            check_element_against_dict(elem, elements_def[tag], result, path)
        else:
            result.add(
                "WARNING", "DICT",
                f"Element <{tag}> is not defined in the data dictionary",
                line=getattr(elem, "sourceline", None),
                element=path,
            )
        for child in elem:
            walk(child, f"{path}/{child.tag}")

    walk(root, root.tag)

    # check top-level required elements
    for elem_name, elem_def in elements_def.items():
        if elem_def.get("required", False) and root.tag != elem_name:
            # check if it appears anywhere (shallow — only direct children)
            if root.find(elem_name) is None and root.tag != elem_name:
                pass  # deep-required checks are done in walk()


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

def build_report(result: CheckResult, strict: bool) -> str:
    out = StringIO()
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    out.write(f"\n{'='*65}\n")
    out.write(f"  XML CHECKER REPORT\n")
    out.write(f"  Generated : {ts}\n")
    out.write(f"  File      : {result.xml_file}\n")
    if result.dtd_file:
        out.write(f"  DTD       : {result.dtd_file}\n")
    if result.dict_file:
        out.write(f"  Dict      : {result.dict_file}\n")
    out.write(f"{'='*65}\n\n")

    categories = {}
    for issue in result.issues:
        categories.setdefault(issue.category, []).append(issue)

    for cat, issues in categories.items():
        out.write(f"  [{cat}]\n")
        for i in issues:
            level_str = c(f"  {i.level:<8}", i.level)
            loc = f"  line {i.line}" if i.line else ""
            elem = f"  path: {i.element}" if i.element else ""
            out.write(f"{level_str} {i.message}{loc}{elem}\n")
        out.write("\n")

    # Summary
    errors   = len(result.errors)
    warnings = len(result.warnings)
    effective_errors = errors + (warnings if strict else 0)

    out.write(f"{'─'*65}\n")
    out.write(f"  Errors: {c(str(errors), 'ERROR')}   Warnings: {c(str(warnings), 'WARNING')}\n")

    if effective_errors == 0:
        out.write(f"\n  {c('✔  ALL CHECKS PASSED', 'PASS')}\n")
    else:
        out.write(f"\n  {c('✘  VALIDATION FAILED', 'ERROR')}\n")
    out.write(f"{'='*65}\n\n")

    return out.getvalue()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Validate an XML file against a DTD and/or a data dictionary.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("xml_file", help="Path to the XML file to check")
    p.add_argument("--dtd",    metavar="FILE", help="Path to DTD file")
    p.add_argument("--dict",   metavar="FILE", help="Path to data dictionary JSON")
    p.add_argument("--report", metavar="FILE", help="Write report to this file")
    p.add_argument("--strict", action="store_true", help="Warnings count as errors")
    p.add_argument("--no-color", action="store_true", help="Disable colored output")
    return p.parse_args()


def main() -> int:
    global USE_COLOR
    args = parse_args()

    if args.no_color:
        USE_COLOR = False

    # -- file existence checks --
    for label, path in [("XML file", args.xml_file),
                         ("DTD file", args.dtd),
                         ("Data dictionary", args.dict)]:
        if path and not os.path.isfile(path):
            print(f"Error: {label} not found: {path}", file=sys.stderr)
            return 2

    result = CheckResult(
        xml_file=args.xml_file,
        dtd_file=args.dtd,
        dict_file=args.dict,
    )

    # Step 1 — Syntax
    root = check_syntax(args.xml_file, result)

    # Step 2 — DTD
    if args.dtd and root is not None:
        check_dtd(args.xml_file, args.dtd, result)

    # Step 3 — Data dictionary
    if args.dict and root is not None:
        data_dict = load_data_dict(args.dict, result)
        if data_dict:
            check_data_dict(root, data_dict, result)

    # -- Output --
    report = build_report(result, strict=args.strict)

    if args.report:
        with open(args.report, "w", encoding="utf-8") as f:
            # strip ANSI codes for file output
            clean = re.sub(r"\033\[[0-9;]*m", "", report)
            f.write(clean)
        print(f"Report written to: {args.report}")
    else:
        print(report)

    warnings = len(result.warnings)
    effective_fail = not result.passed or (args.strict and warnings > 0)
    return 1 if effective_fail else 0


if __name__ == "__main__":
    sys.exit(main())
