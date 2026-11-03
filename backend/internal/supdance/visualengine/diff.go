package visualengine

import (
	"encoding/json"
	"reflect"
	"sort"
)

func ChangedFields(before, after Config) []string {
	firstBytes, _ := json.Marshal(before)
	secondBytes, _ := json.Marshal(after)
	var first, second map[string]interface{}
	_ = json.Unmarshal(firstBytes, &first)
	_ = json.Unmarshal(secondBytes, &second)
	result := []string{}
	var walk func(interface{}, interface{}, string)
	walk = func(left, right interface{}, path string) {
		if reflect.DeepEqual(left, right) {
			return
		}
		leftMap, leftOK := left.(map[string]interface{})
		rightMap, rightOK := right.(map[string]interface{})
		if leftOK && rightOK {
			keys := map[string]bool{}
			for key := range leftMap {
				keys[key] = true
			}
			for key := range rightMap {
				keys[key] = true
			}
			for key := range keys {
				if path == "" && (key == "updatedAt" || key == "updatedBy" || key == "publishedVersion") {
					continue
				}
				next := key
				if path != "" {
					next = path + "." + key
				}
				walk(leftMap[key], rightMap[key], next)
			}
		} else {
			result = append(result, path)
		}
	}
	walk(first, second, "")
	sort.Strings(result)
	return result
}
