package main

import (
	"os"

	"yingce/backend/internal/supdance/stripepayment"
	plugins "yingce/backend/payment-plugins"
)

func main() {
	if err := plugins.RunRPC(stripepayment.New(), os.Stdin, os.Stdout); err != nil {
		os.Exit(1)
	}
}
