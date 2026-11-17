package emailcenter

import (
	"bytes"
	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
	"regexp"
	"strings"
)

var allowedTags = map[string]bool{"p": true, "div": true, "span": true, "strong": true, "b": true, "em": true, "i": true, "br": true, "hr": true, "h1": true, "h2": true, "h3": true, "ul": true, "ol": true, "li": true, "table": true, "tbody": true, "thead": true, "tr": true, "td": true, "th": true, "a": true, "img": true}
var styleValue = regexp.MustCompile(`^[a-zA-Z0-9#.,% ()/_-]+$`)
var styleNames = map[string]bool{"color": true, "background-color": true, "font-size": true, "font-weight": true, "font-family": true, "line-height": true, "text-align": true, "padding": true, "margin": true, "border": true, "border-radius": true, "max-width": true, "width": true, "height": true, "vertical-align": true}

// SanitizeHTML uses an HTML parser, an element/attribute allowlist and a CSS allowlist.
// URL attributes are checked after expansion; no scripts, forms, remote frames or CSS URLs survive.
func SanitizeHTML(raw string, brand Brand) (string, string, error) {
	nodes, err := html.ParseFragment(strings.NewReader(raw), &html.Node{Type: html.ElementNode, Data: "div", DataAtom: atom.Div})
	if err != nil {
		return "", "", err
	}
	var clean func(*html.Node)
	clean = func(parent *html.Node) {
		for node := parent.FirstChild; node != nil; {
			next := node.NextSibling
			if node.Type == html.ElementNode {
				if !allowedTags[node.Data] {
					parent.RemoveChild(node)
					node = next
					continue
				}
				attrs := []html.Attribute{}
				for _, attr := range node.Attr {
					if attr.Namespace != "" {
						continue
					}
					switch attr.Key {
					case "href":
						if node.Data == "a" && SafeURL(attr.Val, brand, false) {
							attrs = append(attrs, attr)
						}
					case "src":
						if node.Data == "img" && SafeURL(attr.Val, brand, true) {
							attrs = append(attrs, attr)
						}
					case "alt", "title":
						attrs = append(attrs, attr)
					case "style":
						var styles []string
						for _, item := range strings.Split(attr.Val, ";") {
							name, value, ok := strings.Cut(item, ":")
							name = strings.TrimSpace(strings.ToLower(name))
							value = strings.TrimSpace(value)
							lower := strings.ToLower(value)
							if ok && styleNames[name] && styleValue.MatchString(value) && !strings.Contains(lower, "url") && !strings.Contains(lower, "expression") && !strings.Contains(lower, "var(") {
								styles = append(styles, name+":"+value)
							}
						}
						if len(styles) > 0 {
							attrs = append(attrs, html.Attribute{Key: "style", Val: strings.Join(styles, ";")})
						}
					case "role":
						if attr.Val == "presentation" {
							attrs = append(attrs, attr)
						}
					case "cellpadding", "cellspacing", "border":
						if attr.Val == "0" {
							attrs = append(attrs, attr)
						}
					}
				}
				node.Attr = attrs
			}
			if node.Type == html.CommentNode {
				parent.RemoveChild(node)
			} else {
				clean(node)
			}
			node = next
		}
	}
	root := &html.Node{Type: html.ElementNode, Data: "div"}
	for _, node := range nodes {
		root.AppendChild(node)
	}
	clean(root)
	var output, text bytes.Buffer
	var plain func(*html.Node)
	plain = func(node *html.Node) {
		if node.Type == html.TextNode {
			text.WriteString(node.Data)
		}
		if node.Type == html.ElementNode && node.Data == "a" {
			for _, a := range node.Attr {
				if a.Key == "href" {
					text.WriteString(" (" + a.Val + ") ")
				}
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			plain(child)
		}
		if node.Type == html.ElementNode {
			text.WriteByte('\n')
		}
	}
	for node := root.FirstChild; node != nil; node = node.NextSibling {
		if err := html.Render(&output, node); err != nil {
			return "", "", err
		}
		plain(node)
	}
	return output.String(), strings.TrimSpace(text.String()), nil
}
