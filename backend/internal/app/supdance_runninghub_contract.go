package app

import "yingce/backend/internal/model"

func validateSupDanceRunningHubImageEdit(protocol model.ChannelInterfaceType, providerModelKey string, intent ModelRequestIntent) error {
	if protocol == "runninghub-standard-image" && providerModelKey == "rhart-image-n-g31-flash-official/image-to-image" && intent.Inputs["image"] == 0 {
		return newModelCapabilityArgumentError("referenceImages", "required", BadAuthRequest("Nano Banana 2 Edit 至少需要一张参考图"))
	}
	return nil
}
