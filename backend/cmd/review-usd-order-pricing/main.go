// review-usd-order-pricing 只读取标准输入中的 JSON 数组，输出离线试价回执。
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"yingce/backend/internal/kernel"
)

type reviewCase struct {
	ID               string `json:"id"`
	OrderUnit        string `json:"orderUnit"`
	Basis            string `json:"basis"`
	RetailUSD        string `json:"retailUSD"`
	CostUSD          string `json:"costUSD"`
	CostSource       string `json:"costSource"`
	NetUSDPerPoint   string `json:"netUSDPerPoint"`
	RevenueSource    string `json:"revenueSource"`
	MinMarginBPS     int64  `json:"minMarginBPS"`
	GrossUSDPerPoint string `json:"grossUSDPerPoint,omitempty"`
}

type receipt struct {
	reviewCase
	Status           string   `json:"status"`
	CommercialPoints *int64   `json:"commercialPoints,omitempty"`
	TrialPoints      *int64   `json:"trialPoints,omitempty"`
	Reasons          []string `json:"reasons,omitempty"`
}

func review(row reviewCase) receipt {
	r := receipt{reviewCase: row, Status: "blocked"}
	if strings.TrimSpace(row.ID) == "" || strings.TrimSpace(row.OrderUnit) == "" {
		r.Reasons = append(r.Reasons, "缺少订单标识或计费单位")
	}
	if row.Basis != "verified" && row.Basis != "scenario" {
		r.Reasons = append(r.Reasons, "basis 须为 verified 或 scenario")
	}
	commercial, err := kernel.USDCommercialOrderPoints(row.RetailUSD)
	if err != nil {
		r.Reasons = append(r.Reasons, "商业零售价无效或超限")
	} else {
		r.CommercialPoints = &commercial
	}
	if row.CostUSD == "" || strings.TrimSpace(row.CostSource) == "" {
		r.Reasons = append(r.Reasons, "缺少整单美元成本或来源")
	}
	if row.NetUSDPerPoint == "" || strings.TrimSpace(row.RevenueSource) == "" {
		r.Reasons = append(r.Reasons, "缺少每分最差税费后净收入或来源")
	}
	if len(r.Reasons) != 0 {
		return r
	}
	points, err := kernel.CalculateUSDOrderPoints(row.RetailUSD, row.CostUSD, row.NetUSDPerPoint, row.MinMarginBPS, row.GrossUSDPerPoint)
	if err != nil {
		r.Reasons = append(r.Reasons, err.Error())
		return r
	}
	r.TrialPoints = &points
	r.Status = "verifiedTrial"
	if row.Basis == "scenario" {
		r.Status = "scenarioOnly"
	}
	return r
}

func run(input io.Reader, output io.Writer) error {
	var rows []reviewCase
	dec := json.NewDecoder(input)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&rows); err != nil {
		return err
	}
	if len(rows) == 0 || !errors.Is(dec.Decode(new(any)), io.EOF) {
		return errors.New("输入须为一个非空 JSON 数组")
	}
	report := struct {
		Blocked  int       `json:"blocked"`
		Receipts []receipt `json:"receipts"`
	}{}
	for _, row := range rows {
		r := review(row)
		if r.Status == "blocked" {
			report.Blocked++
		}
		report.Receipts = append(report.Receipts, r)
	}
	enc := json.NewEncoder(output)
	enc.SetIndent("", "  ")
	if err := enc.Encode(report); err != nil {
		return err
	}
	if report.Blocked > 0 {
		return fmt.Errorf("%d/%d 条试价被阻断，详见回执", report.Blocked, len(rows))
	}
	return nil
}

func main() {
	if len(os.Args) != 1 {
		fmt.Fprintln(os.Stderr, "usage: review-usd-order-pricing < cases.json > receipts.json")
		os.Exit(2)
	}
	if err := run(os.Stdin, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
