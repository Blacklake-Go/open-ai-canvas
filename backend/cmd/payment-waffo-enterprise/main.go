package main

import (
	"context"
	"encoding/json"
	"os"
	"time"

	"yingce/backend/internal/supdance/waffopayment"
	plugins "yingce/backend/payment-plugins"
	sdk "yingce/backend/payment-sdk"
)

func main() {
	provider := waffopayment.New()
	if len(os.Args) == 2 && os.Args[1] == "--payment-methods" {
		var values sdk.Config
		if err := json.NewDecoder(os.Stdin).Decode(&values); err != nil {
			os.Exit(1)
		}
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		data, err := provider.ValidateRemote(ctx, values)
		if err != nil {
			json.NewEncoder(os.Stdout).Encode(map[string]any{"ok": false, "error": err.Error()})
			os.Exit(1)
		}
		json.NewEncoder(os.Stdout).Encode(map[string]any{"ok": true, "data": data})
		return
	}
	if err := plugins.RunRPC(provider, os.Stdin, os.Stdout); err != nil {
		os.Exit(1)
	}
}
