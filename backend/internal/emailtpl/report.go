package emailtpl

import (
	"fmt"
	"html/template"
	"math"
	"strings"
	"time"
	"yingce/backend/internal/supdance/maillocale"
)

// ConsumptionReport 是用户当日消费日报的展示数据；金额单位为微积分（1 积分 = 1,000,000）。
type ConsumptionReport struct {
	Locale      string
	ContentOnly bool
	Brand       string
	UserName    string
	Date        string // YYYY-MM-DD，东八区
	WeekdayName string
	// 当日净消费 = 消费 - 当日退回。
	TotalMicro     int64
	ConsumeMicro   int64
	RefundMicro    int64
	OrderCount     int
	AvailableMicro int64
	// PreviousDayMicro 为昨日净消费；Last7 为截至今日（含）的 7 天净消费，最早的一天在前。
	PreviousDayMicro int64
	Last7            []DayAmount
	Hourly           [24]int64
	Capabilities     []Slice
	Models           []Slice
	TopOrders        []OrderLine
	WalletURL        string
	SettingsURL      string
}

type DayAmount struct {
	Label string // 如 11-06
	Micro int64
}

type Slice struct {
	Label string
	Micro int64
	Count int
}

type OrderLine struct {
	Time  string
	Model string
	Kind  string
	Micro int64
}

var sliceColors = []string{"#3b5bfd", "#7c5cff", "#16a3a3", "#f59e0b", "#ef5b7b", "#9a9aa3"}

type reportView struct {
	L       map[string]string
	Heading string
	ConsumptionReport
	Total, Consume, Refund, Available string
	Delta                             string
	DeltaTone                         string
	AvgLabel                          string
	Runway                            string
	PeakHourLabel                     string
	HourBars                          []bar
	DayBars                           []bar
	CapRows                           []sliceRow
	ModelRows                         []sliceRow
	Orders                            []orderRow
	Insights                          []string
	StackCells                        []stackCell
}

type bar struct {
	Label  string
	Height int
	Color  string
	Title  string
	Value  string
	Strong bool
}

type sliceRow struct {
	Label   string
	Value   string
	Count   int
	Percent string
	Width   int
	Rest    int
	Color   string
}

type stackCell struct {
	Width int
	Color string
}

type orderRow struct {
	Time, Model, Kind, Value string
}

const reportBodyHTML = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:36px 36px 0;">
<div style="font-size:12px;line-height:18px;font-weight:600;letter-spacing:1.2px;color:` + colorAccent + `;">{{.L.consumption_report}}</div>
<div style="padding-top:8px;font-size:24px;line-height:32px;font-weight:700;color:` + colorText + `;letter-spacing:-0.2px;">{{.Heading}}</div>
<div style="padding-top:6px;font-size:14px;line-height:22px;color:` + colorMuted + `;">{{.WeekdayName}} · {{.L.report_period}}</div>
</td></tr>

<tr><td style="padding:24px 36px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="` + colorText + `" style="background:` + colorText + `;border-radius:14px;">
<tr><td style="padding:24px 24px 20px;">
<div style="font-size:13px;line-height:20px;color:#a8a8b3;">{{.L.report_net}}</div>
<div style="padding-top:4px;font-family:'SF Pro Display',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:40px;line-height:48px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">{{.Total}}</div>
<div style="padding-top:8px;font-size:13px;line-height:20px;color:#a8a8b3;"><span style="color:{{.DeltaTone}};font-weight:600;">{{.Delta}}</span>&nbsp;&nbsp;·&nbsp;&nbsp;{{.L.report_average}} {{.AvgLabel}}</div>
</td></tr>
<tr><td style="padding:0 24px 22px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="33%" valign="top" style="border-top:1px solid #2c2c33;padding-top:14px;"><div style="font-size:12px;line-height:18px;color:#8a8a94;">{{.L.report_orders}}</div><div style="font-size:17px;line-height:26px;font-weight:600;color:#ffffff;">{{.OrderCount}}</div></td>
<td width="34%" valign="top" style="border-top:1px solid #2c2c33;padding-top:14px;"><div style="font-size:12px;line-height:18px;color:#8a8a94;">{{.L.report_refunds}}</div><div style="font-size:17px;line-height:26px;font-weight:600;color:#ffffff;">{{.Refund}}</div></td>
<td width="33%" valign="top" style="border-top:1px solid #2c2c33;padding-top:14px;"><div style="font-size:12px;line-height:18px;color:#8a8a94;">{{.L.report_balance}}</div><div style="font-size:17px;line-height:26px;font-weight:600;color:#ffffff;">{{.Available}}</div></td>
</tr></table>
</td></tr>
</table>
</td></tr>

{{if .Insights}}<tr><td style="padding:24px 36px 0;">
<div style="font-size:15px;line-height:22px;font-weight:600;color:` + colorText + `;">{{.L.report_insights}}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">
{{range .Insights}}<tr><td width="18" valign="top" style="padding:7px 0 0;font-size:13px;line-height:20px;color:` + colorAccent + `;">◆</td><td style="padding:6px 0;font-size:14px;line-height:22px;color:` + colorMuted + `;">{{.}}</td></tr>{{end}}
</table>
</td></tr>{{end}}

<tr><td style="padding:28px 36px 0;">
<div style="font-size:15px;line-height:22px;font-weight:600;color:` + colorText + `;">{{.L.report_hours}}</div>
<div style="padding-top:2px;font-size:12px;line-height:18px;color:` + colorFaint + `;">{{.L.report_hourly}}{{if .PeakHourLabel}} · {{.L.report_peak}} {{.PeakHourLabel}}{{end}}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;border-bottom:1px solid ` + colorLine + `;">
<tr>{{range .HourBars}}<td valign="bottom" align="center" height="96" style="height:96px;padding:0 1px;" title="{{.Title}}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="{{.Height}}" bgcolor="{{.Color}}" style="height:{{.Height}}px;line-height:{{.Height}}px;font-size:0;background:{{.Color}};border-radius:3px 3px 0 0;">&nbsp;</td></tr></table></td>{{end}}</tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="25%" style="padding-top:6px;font-size:11px;color:` + colorFaint + `;">00:00</td>
<td width="25%" style="padding-top:6px;font-size:11px;color:` + colorFaint + `;">06:00</td>
<td width="25%" style="padding-top:6px;font-size:11px;color:` + colorFaint + `;">12:00</td>
<td width="25%" style="padding-top:6px;font-size:11px;color:` + colorFaint + `;">18:00</td>
</tr></table>
</td></tr>

{{if .CapRows}}<tr><td style="padding:28px 36px 0;">
<div style="font-size:15px;line-height:22px;font-weight:600;color:` + colorText + `;">{{.L.report_composition}}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;border-radius:6px;overflow:hidden;"><tr>{{range .StackCells}}<td width="{{.Width}}%" height="10" bgcolor="{{.Color}}" style="height:10px;font-size:0;line-height:10px;background:{{.Color}};">&nbsp;</td>{{end}}</tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
{{range .CapRows}}<tr>
<td width="14" style="padding:7px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="8" height="8" bgcolor="{{.Color}}" style="width:8px;height:8px;font-size:0;line-height:8px;border-radius:2px;background:{{.Color}};">&nbsp;</td></tr></table></td>
<td style="padding:7px 0;font-size:14px;line-height:20px;color:` + colorText + `;">{{.Label}} <span style="color:` + colorFaint + `;font-size:12px;">· {{.Count}} {{$.L.runs}}</span></td>
<td align="right" style="padding:7px 0;font-size:14px;line-height:20px;color:` + colorText + `;font-weight:600;">{{.Value}}</td>
<td align="right" width="56" style="padding:7px 0;font-size:12px;line-height:20px;color:` + colorFaint + `;">{{.Percent}}</td>
</tr>{{end}}
</table>
</td></tr>{{end}}

{{if .ModelRows}}<tr><td style="padding:24px 36px 0;">
<div style="font-size:15px;line-height:22px;font-weight:600;color:` + colorText + `;">{{.L.report_models}}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">
{{range $index, $row := .ModelRows}}<tr><td style="padding:10px 0 4px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-size:13px;line-height:20px;color:` + colorText + `;"><span style="display:inline-block;width:18px;color:` + colorFaint + `;">{{inc $index}}</span>{{$row.Label}} <span style="color:` + colorFaint + `;font-size:12px;">· {{$row.Count}} {{$.L.runs}}</span></td>
<td align="right" style="font-size:13px;line-height:20px;color:` + colorText + `;font-weight:600;">{{$row.Value}} <span style="color:` + colorFaint + `;font-weight:400;">{{$row.Percent}}</span></td>
</tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;"><tr>
<td width="{{$row.Width}}%" height="6" bgcolor="{{$row.Color}}" style="height:6px;font-size:0;line-height:6px;background:{{$row.Color}};border-radius:3px;">&nbsp;</td>
{{if $row.Rest}}<td width="{{$row.Rest}}%" height="6" bgcolor="` + colorSurface + `" style="height:6px;font-size:0;line-height:6px;background:` + colorSurface + `;">&nbsp;</td>{{end}}
</tr></table>
</td></tr>{{end}}
</table>
</td></tr>{{end}}

<tr><td style="padding:28px 36px 0;">
<div style="font-size:15px;line-height:22px;font-weight:600;color:` + colorText + `;">{{.L.report_trend}}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
<tr>{{range .DayBars}}<td width="14%" valign="bottom" align="center" height="110" style="height:110px;padding:0 6px;">
<div style="font-size:11px;line-height:16px;color:{{if .Strong}}` + colorText + `{{else}}` + colorFaint + `{{end}};font-weight:{{if .Strong}}700{{else}}400{{end}};padding-bottom:4px;">{{.Value}}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="{{.Height}}" bgcolor="{{.Color}}" style="height:{{.Height}}px;font-size:0;line-height:{{.Height}}px;background:{{.Color}};border-radius:4px 4px 0 0;">&nbsp;</td></tr></table>
</td>{{end}}</tr>
<tr>{{range .DayBars}}<td align="center" style="padding-top:8px;border-top:1px solid ` + colorLine + `;font-size:11px;line-height:16px;color:{{if .Strong}}` + colorText + `{{else}}` + colorFaint + `{{end}};font-weight:{{if .Strong}}600{{else}}400{{end}};">{{.Label}}</td>{{end}}</tr>
</table>
</td></tr>

{{if .Orders}}<tr><td style="padding:28px 36px 0;">
<div style="font-size:15px;line-height:22px;font-weight:600;color:` + colorText + `;">{{.L.report_top}} · {{len .Orders}}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
{{range .Orders}}<tr>
<td width="52" style="padding:10px 0;border-bottom:1px solid ` + colorLine + `;font-size:12px;line-height:18px;color:` + colorFaint + `;font-family:'SF Mono',Menlo,Consolas,monospace;">{{.Time}}</td>
<td style="padding:10px 8px;border-bottom:1px solid ` + colorLine + `;font-size:13px;line-height:18px;color:` + colorText + `;">{{.Model}} <span style="color:` + colorFaint + `;font-size:12px;">· {{.Kind}}</span></td>
<td align="right" style="padding:10px 0;border-bottom:1px solid ` + colorLine + `;font-size:13px;line-height:18px;color:` + colorText + `;font-weight:600;">{{.Value}}</td>
</tr>{{end}}
</table>
</td></tr>{{end}}

<tr><td style="padding:28px 36px 36px;">
{{if .WalletURL}}<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="` + colorText + `" style="border-radius:10px;background:` + colorText + `;"><a href="{{.WalletURL}}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">{{.L.report_details}} →</a></td></tr></table>{{end}}
<div style="padding-top:20px;border-top:1px solid ` + colorLine + `;margin-top:24px;font-size:12px;line-height:20px;color:` + colorFaint + `;">{{.L.report_notice}}{{if .SettingsURL}} <a href="{{.SettingsURL}}" style="color:` + colorMuted + `;">{{.L.settings}}</a>{{end}}</div>
</td></tr>
</table>`

var reportBodyTemplate = template.Must(template.New("report").Funcs(template.FuncMap{"inc": func(i int) int { return i + 1 }}).Parse(reportBodyHTML))

// FormatCredits 把微积分转成最多两位小数的积分文本，例如 1,234.5。
func FormatCredits(micro int64) string {
	negative := micro < 0
	if negative {
		micro = -micro
	}
	cents := (micro + 5_000) / 10_000
	whole, frac := cents/100, cents%100
	digits := fmt.Sprintf("%d", whole)
	var grouped strings.Builder
	for i, r := range digits {
		if i > 0 && (len(digits)-i)%3 == 0 {
			grouped.WriteByte(',')
		}
		grouped.WriteRune(r)
	}
	text := grouped.String()
	if frac != 0 {
		text += strings.TrimRight(fmt.Sprintf(".%02d", frac), "0")
	}
	if negative {
		return "-" + text
	}
	return text
}

func RenderConsumptionReport(report ConsumptionReport) (Rendered, error) {
	t := func(key string, args ...any) string { return maillocale.Text(report.Locale, key, args...) }
	view := buildReportView(report)
	body, err := renderPart(reportBodyTemplate, view)
	if err != nil {
		return Rendered{}, err
	}
	preheader := t("report_preheader", view.Total, report.OrderCount, firstOr(view.Insights, ""))
	title := t("consumption_report")
	html, err := renderLayout(layoutData{Locale: report.Locale, Title: title, Preheader: preheader, Brand: report.Brand, Width: 600, Body: body, FooterNote: t("report_bill")})
	if err != nil {
		return Rendered{}, err
	}
	var text strings.Builder
	text.WriteString(t("report_text", report.Brand, report.Date, view.Total, view.Delta, report.OrderCount, view.Refund, view.Available))
	for _, section := range []struct {
		label string
		rows  []sliceRow
	}{{"report_composition", view.CapRows}, {"report_models", view.ModelRows}} {
		if len(section.rows) > 0 {
			text.WriteString("\n" + t(section.label) + ":\n")
			for _, row := range section.rows {
				text.WriteString(t("report_detail_line", row.Label, row.Value, row.Percent, row.Count))
			}
		}
	}
	if len(view.Insights) > 0 {
		text.WriteString("\n" + t("report_insights") + ":\n")
		for _, line := range view.Insights {
			text.WriteString("- " + line + "\n")
		}
	}
	if report.WalletURL != "" {
		text.WriteString("\n" + t("report_details") + ": " + report.WalletURL + "\n")
	}
	text.WriteString("\n" + t("report_notice"))
	if report.ContentOnly {
		html = string(body)
	}
	dateLabel := report.Date
	if maillocale.Resolve(report.Locale) == "zh-CN" || maillocale.Resolve(report.Locale) == "zh-TW" {
		dateLabel = shortDate(report.Date)
	}
	subject := t("report_subject_format", report.Brand, dateLabel, view.Total)
	return Rendered{Subject: subject, Text: text.String(), HTML: html}, nil
}

func buildReportView(report ConsumptionReport) reportView {
	t := func(key string, args ...any) string { return maillocale.Text(report.Locale, key, args...) }
	format := func(value int64) string { return FormatCreditsLocale(value, report.Locale) }
	view := reportView{ConsumptionReport: report, L: maillocale.Labels(report.Locale), Heading: t("report_heading", report.UserName, report.Date)}
	if day, err := time.Parse("2006-01-02", report.Date); err == nil {
		view.WeekdayName = strings.Split(t("weekdays"), "|")[day.Weekday()]
	}
	view.Total = format(report.TotalMicro)
	view.Consume = format(report.ConsumeMicro)
	view.Refund = format(report.RefundMicro)
	view.Available = format(report.AvailableMicro)

	var weekSum int64
	activeDays := 0
	for _, day := range report.Last7 {
		weekSum += day.Micro
		if day.Micro > 0 {
			activeDays++
		}
	}
	avg := int64(0)
	if len(report.Last7) > 0 {
		avg = weekSum / int64(len(report.Last7))
	}
	view.AvgLabel = format(avg)
	switch {
	case report.PreviousDayMicro <= 0:
		view.Delta, view.DeltaTone = t("report_no_yesterday"), "#c7c7d1"
	default:
		change := float64(report.TotalMicro-report.PreviousDayMicro) / float64(report.PreviousDayMicro) * 100
		if change >= 0 {
			view.Delta, view.DeltaTone = t("report_up", change), "#ff9d7a"
		} else {
			view.Delta, view.DeltaTone = t("report_down", -change), "#5ee0a7"
		}
	}

	// 小时柱状图：零值保留 2px 底线，便于看出时间轴。
	var hourMax int64
	peak := -1
	for hour, value := range report.Hourly {
		if value > hourMax {
			hourMax, peak = value, hour
		}
	}
	for hour, value := range report.Hourly {
		height := 2
		color := colorLine
		if value > 0 && hourMax > 0 {
			height = max(4, int(math.Round(float64(value)/float64(hourMax)*88)))
			color = "#b9c4ff"
			if hour == peak {
				color = colorAccent
			}
		}
		view.HourBars = append(view.HourBars, bar{Height: height, Color: color, Title: fmt.Sprintf("%02d:00 %s %s", hour, format(value), t("credits"))})
	}
	if peak >= 0 {
		view.PeakHourLabel = fmt.Sprintf("%02d:00–%02d:59", peak, peak)
	}

	var dayMax int64
	for _, day := range report.Last7 {
		dayMax = max(dayMax, day.Micro)
	}
	for index, day := range report.Last7 {
		last := index == len(report.Last7)-1
		height, color := 3, colorLine
		if day.Micro > 0 && dayMax > 0 {
			height = max(4, int(math.Round(float64(day.Micro)/float64(dayMax)*80)))
			color = "#d5dbff"
			if last {
				color = colorAccent
			}
		}
		value := format(day.Micro)
		if day.Micro == 0 {
			value = "—"
		}
		label := day.Label
		if last {
			label = t("today")
		}
		view.DayBars = append(view.DayBars, bar{Label: label, Height: height, Color: color, Value: value, Strong: last})
	}

	consume := max(report.ConsumeMicro, 1)
	view.CapRows = sliceRows(report.Capabilities, consume, 6, report.Locale)
	view.ModelRows = sliceRows(report.Models, consume, 5, report.Locale)
	remaining := 100
	for index, row := range view.CapRows {
		width := row.Width
		if index == len(view.CapRows)-1 {
			width = remaining
		}
		if width <= 0 {
			continue
		}
		remaining -= width
		view.StackCells = append(view.StackCells, stackCell{Width: width, Color: row.Color})
	}
	for _, order := range report.TopOrders {
		view.Orders = append(view.Orders, orderRow{Time: order.Time, Model: order.Model, Kind: order.Kind, Value: format(order.Micro)})
	}

	if avg > 0 && report.AvailableMicro > 0 {
		days := float64(report.AvailableMicro) / float64(avg)
		if days < 1000 {
			view.Runway = fmt.Sprintf("%.0f", math.Floor(days))
		}
	}
	view.Insights = reportInsights(report, view, avg, activeDays, peak)
	return view
}

func sliceRows(items []Slice, total int64, limit int, locales ...string) []sliceRow {
	rows := []sliceRow{}
	var otherMicro int64
	otherCount := 0
	for index, item := range items {
		if index >= limit-1 && len(items) > limit {
			otherMicro += item.Micro
			otherCount += item.Count
			continue
		}
		rows = append(rows, newSliceRow(item.Label, item.Micro, item.Count, total, len(rows), strings.Join(locales, ",")))
	}
	if otherMicro > 0 {
		rows = append(rows, newSliceRow(maillocale.Text(strings.Join(locales, ","), "other"), otherMicro, otherCount, total, len(sliceColors)-1, strings.Join(locales, ",")))
	}
	return rows
}

func newSliceRow(label string, micro int64, count int, total int64, colorIndex int, locales ...string) sliceRow {
	share := float64(micro) / float64(total) * 100
	width := int(math.Round(share))
	width = min(max(width, 1), 100)
	return sliceRow{Label: label, Value: FormatCreditsLocale(micro, strings.Join(locales, ",")), Count: count, Percent: formatDecimalLocale(share, 1, strings.Join(locales, ",")) + "%", Width: width, Rest: 100 - width, Color: sliceColors[min(colorIndex, len(sliceColors)-1)]}
}

func reportInsights(report ConsumptionReport, view reportView, avg int64, activeDays int, peak int) []string {
	t := func(key string, args ...any) string { return maillocale.Text(report.Locale, key, args...) }
	lines := []string{}
	if len(report.Capabilities) > 0 {
		top := view.CapRows[0]
		lines = append(lines, t("insight_top", top.Label, top.Percent, top.Count))
	}
	if len(report.Models) > 0 && report.Models[0].Count > 0 {
		top := report.Models[0]
		lines = append(lines, t("insight_model", top.Label, FormatCreditsLocale(top.Micro/int64(top.Count), report.Locale)))
	}
	if avg > 0 {
		ratio := float64(report.TotalMicro) / float64(avg)
		switch {
		case ratio >= 1.5:
			lines = append(lines, t("insight_high", formatDecimalLocale(ratio, 1, report.Locale)))
		case ratio <= 0.5:
			lines = append(lines, t("insight_low"))
		}
	}
	if report.RefundMicro > 0 {
		lines = append(lines, t("insight_refund", view.Refund))
	}
	if peak >= 0 && report.TotalMicro > 0 {
		share := float64(report.Hourly[peak]) / float64(max(report.ConsumeMicro, 1)) * 100
		if share >= 40 {
			lines = append(lines, t("insight_peak", peak, share))
		}
	}
	if view.Runway != "" {
		lines = append(lines, t("insight_runway", view.Runway))
	} else if report.AvailableMicro <= 0 {
		lines = append(lines, t("insight_empty"))
	}
	if activeDays >= 7 {
		lines = append(lines, t("insight_streak"))
	}
	if len(lines) > 5 {
		lines = lines[:5]
	}
	return lines
}

func shortDate(date string) string {
	if len(date) == 10 {
		return strings.TrimLeft(date[5:7], "0") + " 月 " + strings.TrimLeft(date[8:10], "0") + " 日"
	}
	return date
}

func firstOr(values []string, fallback string) string {
	if len(values) > 0 {
		return values[0]
	}
	return fallback
}
