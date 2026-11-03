package visualengine

import (
	"bytes"
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
)

func DecodeConfig(raw []byte) (Config, error) {
	var config Config
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&config); err != nil {
		return Config{}, err
	}
	if err := requireConfigFields(raw, reflect.TypeOf(config), "config"); err != nil {
		return Config{}, err
	}
	if err := ValidateConfig(config); err != nil {
		return Config{}, err
	}
	return config, nil
}

func requireConfigFields(raw json.RawMessage, fieldType reflect.Type, path string) error {
	if len(raw) == 0 || bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
		return fmt.Errorf("视觉配置字段缺失或为空：%s", path)
	}
	if fieldType.Kind() == reflect.Pointer {
		fieldType = fieldType.Elem()
	}
	switch fieldType.Kind() {
	case reflect.Struct:
		var fields map[string]json.RawMessage
		if err := json.Unmarshal(raw, &fields); err != nil {
			return err
		}
		for index := 0; index < fieldType.NumField(); index++ {
			field := fieldType.Field(index)
			tag := field.Tag.Get("json")
			name := strings.Split(tag, ",")[0]
			value, present := fields[name]
			if !present && strings.Contains(tag, ",omitempty") {
				continue
			}
			if err := requireConfigFields(value, field.Type, path+"."+name); err != nil {
				return err
			}
		}
	case reflect.Map:
		var fields map[string]json.RawMessage
		if err := json.Unmarshal(raw, &fields); err != nil {
			return err
		}
		for name, value := range fields {
			if err := requireConfigFields(value, fieldType.Elem(), path+"."+name); err != nil {
				return err
			}
		}
	case reflect.Slice:
		var entries []json.RawMessage
		if err := json.Unmarshal(raw, &entries); err != nil {
			return err
		}
		for index, value := range entries {
			if err := requireConfigFields(value, fieldType.Elem(), fmt.Sprintf("%s[%d]", path, index)); err != nil {
				return err
			}
		}
	}
	return nil
}
