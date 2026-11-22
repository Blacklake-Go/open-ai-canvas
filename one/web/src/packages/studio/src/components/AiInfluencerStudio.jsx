"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import toast from "react-hot-toast";
import { ToastHost as Toaster } from "../ui";
import { generateImage } from "../muapi.js";
import { applyActiveModelDirectory } from "../models.js";
import { formatErrorMessage } from "../utils/formatError.js";
import MobileGenerationActions, {
  GenerationCopyButtons,
} from "./MobileGenerationActions.jsx";
import en from "../messages/en/aiInfluencerStudio.json";
import zh from "../messages/zh/aiInfluencerStudio.json";
import ja from "../messages/ja-JP/aiInfluencerStudio.json";
import ko from "../messages/ko-KR/aiInfluencerStudio.json";
import zhTw from "../messages/zh-TW/aiInfluencerStudio.json";
import es from "../messages/es/aiInfluencerStudio.json";
import { resolveCopy } from "../i18nUtils";

const AI_INFLUENCER_MESSAGES = {
  'zh-CN': zh,
  'ja-JP': ja,
  'ko-KR': ko,
  'zh-TW': zhTw,
  es: es,
  'es-ES': es,
};

const CDN = "https://cdn.muapi.ai/influencer";

const TABS_CONFIG = {
  face: {
    label: "Face",
    subcategories: [
      {
        id: "character_type",
        label: "Character Type",
        options: [
          { id: "human",             label: "Human",    img: `${CDN}/character_type_human.webp`,             promptVal: "human features" },
          { id: "elf",               label: "Elf",      img: `${CDN}/character_type_elf.webp`,               promptVal: "elf with pointed ears" },
          { id: "alien",             label: "Alien",    img: `${CDN}/character_type_alien.webp`,             promptVal: "alien creature" },
          { id: "amphibian",         label: "Amphibian",img: `${CDN}/character_type_amphibian.webp`,         promptVal: "amphibian humanoid" },
          { id: "reptile",           label: "Reptile",  img: `${CDN}/character_type_reptile.webp`,           promptVal: "reptilian creature" },
          { id: "mantis",            label: "Mantis",   img: `${CDN}/character_type_mantis.webp`,            promptVal: "mantis hybrid character" },
          { id: "bee",               label: "Bee",      img: `${CDN}/character_type_bee.webp`,               promptVal: "bee insect hybrid character" },
          { id: "octopus",           label: "Octopus",  img: `${CDN}/character_type_octopus.webp`,           promptVal: "aquatic octopus hybrid" },
          { id: "crocodile",         label: "Crocodile",img: `${CDN}/character_type_crocodile.webp`,         promptVal: "crocodile humanoid" },
          { id: "iguana",            label: "Iguana",   img: `${CDN}/character_type_iguana.webp`,            promptVal: "iguana humanoid" },
          { id: "lizard",            label: "Lizard",   img: `${CDN}/character_type_lizard.webp`,            promptVal: "lizard humanoid" },
          { id: "rhinoceros_beetle", label: "Beetle",   img: `${CDN}/character_type_rhinoceros_beetle.webp`, promptVal: "rhinoceros beetle humanoid" },
          { id: "ant",               label: "Ant",      img: `${CDN}/character_type_ant.webp`,               promptVal: "ant hybrid character" },
        ],
      },
      {
        id: "gender",
        label: "Gender",
        options: [
          { id: "female",      label: "Female",      img: `${CDN}/gender_female.webp`,      promptVal: "female" },
          { id: "male",        label: "Male",        img: `${CDN}/gender_male.webp`,        promptVal: "male" },
          { id: "non_binary",  label: "Non-binary",  img: `${CDN}/gender_non_binary.webp`,  promptVal: "non-binary character" },
          { id: "trans_man",   label: "Trans Man",   img: `${CDN}/gender_trans_man.webp`,   promptVal: "transgender man" },
          { id: "trans_woman", label: "Trans Woman", img: `${CDN}/gender_trans_woman.webp`, promptVal: "transgender woman" },
        ],
      },
      {
        id: "ethnicity_origin_base",
        label: "Ethnicity / Origin",
        options: [
          { id: "african",        label: "African",       img: `${CDN}/ethnicity_origin_base_african.webp`,                                  promptVal: "african heritage" },
          { id: "asian",          label: "Asian",         img: `${CDN}/ethnicity_origin_base_recreate_in_east_asian_supermodel__korea.webp`, promptVal: "East Asian phenotype, sharp anime aesthetics" },
          { id: "european",       label: "European",      img: `${CDN}/ethnicity_origin_base_scandinavian_supermodel.webp`,                  promptVal: "Scandinavian Nordic aesthetics" },
          { id: "indian",         label: "Indian",        img: `${CDN}/ethnicity_origin_base_indian.webp`,                                   promptVal: "south asian indian heritage" },
          { id: "middle_eastern", label: "Middle Eastern",img: `${CDN}/ethnicity_origin_base_middle_eastern.webp`,                           promptVal: "middle eastern heritage" },
          { id: "mixed",          label: "Mixed",         img: `${CDN}/ethnicity_origin_base_mixed.webp`,                                    promptVal: "multiracial mixed heritage" },
        ],
      },
      {
        id: "eye_color",
        label: "Eye Color",
        options: [
          { id: "eye_blue",       label: "Blue",         img: `${CDN}/eye_color_eye_blue.webp`,       promptVal: "striking blue eyes" },
          { id: "eye_brown",      label: "Brown",        img: `${CDN}/eye_color_eye_brown.webp`,      promptVal: "warm brown eyes" },
          { id: "eye_green",      label: "Green",        img: `${CDN}/eye_color_eye_green.webp`,      promptVal: "emerald green eyes" },
          { id: "eye_amber",      label: "Amber",        img: `${CDN}/eye_color_eye_amber.webp`,      promptVal: "amber eyes" },
          { id: "eye_grey",       label: "Grey",         img: `${CDN}/eye_color_eye_grey.webp`,       promptVal: "grey eyes" },
          { id: "eye_red",        label: "Red",          img: `${CDN}/eye_color_eye_red.webp`,        promptVal: "red eyes" },
          { id: "eye_purple",     label: "Purple",       img: `${CDN}/eye_color_eye_purple.webp`,     promptVal: "violet purple eyes" },
          { id: "eye_black",      label: "Black",        img: `${CDN}/eye_color_eye_black.webp`,      promptVal: "black eyes" },
          { id: "eye_deep_brown", label: "Deep Brown",   img: `${CDN}/eye_color_eye_deep_brown.webp`, promptVal: "deep dark brown eyes" },
          { id: "eye_white",      label: "White",        img: `${CDN}/eye_color_eye_white.webp`,      promptVal: "white eyes" },
          { id: "eye_black_void", label: "Solid Black",  img: `${CDN}/eye_color_eye_black_void.webp`, promptVal: "solid black void eyes" },
          { id: "eye_white_void", label: "Blind / Empty",img: `${CDN}/eye_color_eye_white_void.webp`, promptVal: "blind empty white eyes" },
        ],
      },
      {
        id: "eyes_type",
        label: "Eye Type",
        options: [
          { id: "eyes_human",      label: "Human",     img: `${CDN}/eyes_type_eyes_human.webp`,      promptVal: "expressive eyes" },
          { id: "eyes_reptile",    label: "Reptile",   img: `${CDN}/eyes_type_eyes_reptile.webp`,    promptVal: "reptile slit-pupil eyes" },
          { id: "eyes_mechanical", label: "Mechanical",img: `${CDN}/eyes_type_eyes_mechanical.webp`, promptVal: "mechanical glowing cyborg optic eyes" },
        ],
      },
      {
        id: "eyes_details",
        label: "Eye Features",
        options: [
          { id: "eyes_different_colors", label: "Heterochromia", img: `${CDN}/eyes_details_eyes_different_colors.webp`, promptVal: "heterochromia different eye colors" },
          { id: "eyes_blind",            label: "Blind Eye",     img: `${CDN}/eyes_details_eyes_blind.webp`,            promptVal: "one cloudy blind eye" },
          { id: "eyes_scarred",          label: "Scarred Eye",   img: `${CDN}/eyes_details_eyes_scarred.webp`,          promptVal: "scar running across one eye" },
          { id: "eyes_glowing",          label: "Glowing Eye",   img: `${CDN}/eyes_details_eyes_glowing.webp`,          promptVal: "glowing magical eyes" },
        ],
      },
      {
        id: "mouth",
        label: "Mouth & Teeth",
        options: [
          { id: "mouth_small",           label: "Small Mouth",   img: `${CDN}/mouth_mouth_small.webp`,           promptVal: "small delicate mouth" },
          { id: "mouth_large",           label: "Large Mouth",   img: `${CDN}/mouth_mouth_large.webp`,           promptVal: "wide expressive mouth" },
          { id: "mouth_no_teeth",        label: "No Teeth",      img: `${CDN}/mouth_mouth_no_teeth.webp`,        promptVal: "no visible teeth" },
          { id: "mouth_different_teeth", label: "Unique Teeth",  img: `${CDN}/mouth_mouth_different_teeth.webp`, promptVal: "unusual tooth structure" },
          { id: "mouth_sharp_teeth",     label: "Sharp Teeth",   img: `${CDN}/mouth_mouth_sharp_teeth.webp`,     promptVal: "sharp predatory fangs" },
          { id: "mouth_forked_tongue",   label: "Forked Tongue", img: `${CDN}/mouth_mouth_forked_tongue.webp`,   promptVal: "reptilian forked tongue" },
          { id: "mouth_two_tongues",     label: "Two Tongues",   img: `${CDN}/mouth_mouth_two_tongues.webp`,     promptVal: "two separate tongues" },
        ],
      },
      {
        id: "ears",
        label: "Ears",
        options: [
          { id: "ears_human", label: "Human",     img: `${CDN}/ears_ears_human.webp`, promptVal: "normal human ears" },
          { id: "ears_elf",   label: "Elf Ears",  img: `${CDN}/ears_ears_elf.webp`,   promptVal: "pointed elf ears" },
          { id: "ears_no",    label: "No Ears",   img: `${CDN}/ears_ears_no.webp`,    promptVal: "no visible ears" },
          { id: "ears_wings", label: "Wing Ears", img: `${CDN}/ears_ears_wings.webp`, promptVal: "wing ears" },
        ],
      },
      {
        id: "horns",
        label: "Horns",
        options: [
          { id: "horns_none",  label: "None",        img: `${CDN}/character_type_human.webp`, promptVal: "" },
          { id: "small_horns", label: "Small Horns", img: `${CDN}/horns_small_horns.webp`,   promptVal: "small horns on forehead" },
          { id: "big_horns",   label: "Big Horns",   img: `${CDN}/horns_big_horns.webp`,     promptVal: "large curved horns" },
          { id: "antlers",     label: "Antlers",      img: `${CDN}/horns_antlers.webp`,        promptVal: "deer antlers on head" },
        ],
      },
      {
        id: "skin_conditions",
        label: "Skin Conditions",
        options: [
          { id: "condition_normal",       label: "Clear Skin",   img: `${CDN}/character_type_human.webp`,                   promptVal: "flawless clean skin" },
          { id: "condition_freckles",     label: "Freckles",     img: `${CDN}/skin_conditions_condition_freckles.webp`,     promptVal: "freckled skin" },
          { id: "condition_vitiligo",     label: "Vitiligo",     img: `${CDN}/skin_conditions_condition_vitiligo.webp`,     promptVal: "vitiligo skin condition" },
          { id: "condition_scars",        label: "Scars",        img: `${CDN}/skin_conditions_condition_scars.webp`,        promptVal: "battle scarred skin" },
          { id: "condition_pigmentation", label: "Pigmentation", img: `${CDN}/skin_conditions_condition_pigmentation.webp`, promptVal: "hyperpigmentation" },
          { id: "condition_birthmarks",   label: "Birthmarks",   img: `${CDN}/skin_conditions_condition_birthmarks.webp`,   promptVal: "visible birthmarks" },
          { id: "condition_burns",        label: "Burns",        img: `${CDN}/skin_conditions_condition_burns.webp`,        promptVal: "burn marks on skin" },
          { id: "condition_albinism",     label: "Albinism",     img: `${CDN}/skin_conditions_condition_albinism.webp`,     promptVal: "albinism pale white skin" },
          { id: "condition_cracked",      label: "Cracked Skin", img: `${CDN}/skin_conditions_condition_cracked.webp`,      promptVal: "cracked dry skin texture" },
          { id: "condition_wrinkled",     label: "Wrinkled",     img: `${CDN}/skin_conditions_condition_wrinkled.webp`,     promptVal: "wrinkled aged skin" },
        ],
      },
    ],
  },
  body: {
    label: "Body",
    subcategories: [
      {
        id: "face_skin_material",
        label: "Face Skin Material",
        options: [
          { id: "face_skin_human",     label: "Human Skin",  img: `${CDN}/face_skin_material_face_skin_human.webp`,     promptVal: "smooth natural skin" },
          { id: "face_skin_scales",    label: "Scales",      img: `${CDN}/face_skin_material_face_skin_scales.webp`,    promptVal: "shimmering iridescent scales" },
          { id: "face_skin_fur",       label: "Fur",         img: `${CDN}/face_skin_material_face_skin_fur.webp`,       promptVal: "soft fur covered skin" },
          { id: "face_skin_amphibian", label: "Amphibian",   img: `${CDN}/face_skin_material_face_skin_amphibian.webp`, promptVal: "smooth moist amphibian skin" },
          { id: "face_skin_fish",      label: "Fish Skin",   img: `${CDN}/face_skin_material_face_skin_fish.webp`,      promptVal: "iridescent fish scale skin" },
          { id: "face_skin_metallic",  label: "Metallic",    img: `${CDN}/face_skin_material_face_skin_metallic.webp`,  promptVal: "polished chrome metallic skin" },
        ],
      },
      {
        id: "face_surface_pattern",
        label: "Skin Pattern",
        options: [
          { id: "face_pattern_solid",    label: "Solid",          img: `${CDN}/face_surface_pattern_face_pattern_solid.webp`,    promptVal: "solid tone skin" },
          { id: "face_pattern_stripes",  label: "Stripes",        img: `${CDN}/face_surface_pattern_face_pattern_stripes.webp`,  promptVal: "exotic striped skin pattern" },
          { id: "face_pattern_spots",    label: "Spots",          img: `${CDN}/face_surface_pattern_face_pattern_spots.webp`,    promptVal: "dappled spotted skin" },
          { id: "face_pattern_chess",    label: "Chess",          img: `${CDN}/face_surface_pattern_face_pattern_chess.webp`,    promptVal: "checkerboard skin pattern" },
          { id: "face_pattern_veins",    label: "Veins",          img: `${CDN}/face_surface_pattern_face_pattern_veins.webp`,    promptVal: "translucent skin with glowing veins" },
          { id: "face_pattern_gradient", label: "Gradient",       img: `${CDN}/face_surface_pattern_face_pattern_gradient.webp`, promptVal: "gradient skin coloring" },
          { id: "face_pattern_giraffe",  label: "Giraffe",        img: `${CDN}/face_surface_pattern_face_pattern_giraffe.webp`,  promptVal: "giraffe print skin markings" },
        ],
      },
      {
        id: "body_type",
        label: "Body Type",
        options: [
          { id: "body_slim",     label: "Slim",     img: `${CDN}/body_type_body_slim.webp`,     promptVal: "slim slender physique" },
          { id: "body_lean",     label: "Lean",     img: `${CDN}/body_type_body_lean.webp`,     promptVal: "lean toned physique" },
          { id: "body_athletic", label: "Athletic", img: `${CDN}/body_type_body_athletic.webp`, promptVal: "fit athletic body" },
          { id: "body_muscular", label: "Muscular", img: `${CDN}/body_type_body_muscular.webp`, promptVal: "strong muscular build" },
          { id: "body_curvy",    label: "Curvy",    img: `${CDN}/body_type_body_curvy.webp`,    promptVal: "curvy body type" },
          { id: "body_heavy",    label: "Heavy",    img: `${CDN}/body_type_body_heavy.webp`,    promptVal: "heavy set powerful build" },
          { id: "body_skinny",   label: "Skinny",   img: `${CDN}/body_type_body_skinny.webp`,   promptVal: "very skinny thin build" },
        ],
      },
      {
        id: "left_arm",
        label: "Left Arm",
        options: [
          { id: "left_arm_normal",     label: "Normal",         img: `${CDN}/left_arm_left_arm_normal.webp`,                          promptVal: "normal left arm" },
          { id: "left_arm_robotic",    label: "Robotic",        img: `${CDN}/left_arm_left_arm_robotic.webp`,                         promptVal: "high-tech robotic cybernetic left arm" },
          { id: "left_arm_mechanical", label: "Mechanical",     img: `${CDN}/left_arm_left_arm_mechanical.webp`,                      promptVal: "heavy industrial mechanical left arm" },
          { id: "left_arm_cute",       label: "Cute Prosthetic",img: `${CDN}/left_arm_make_left_arm_stylish_pink_prosthetic_wi.webp`, promptVal: "stylish pink prosthetic left arm with custom art" },
          { id: "left_arm_prosthetic", label: "Prosthetic",     img: `${CDN}/left_arm_left_arm_prosthetic.webp`,                      promptVal: "sleek prosthetic left arm" },
          { id: "left_arm_none",       label: "None",           img: `${CDN}/left_arm_left_arm_none.webp`,                            promptVal: "no left arm" },
        ],
      },
      {
        id: "right_arm",
        label: "Right Arm",
        options: [
          { id: "right_arm_normal",     label: "Normal",         img: `${CDN}/right_arm_right_arm_normal.webp`,                          promptVal: "normal right arm" },
          { id: "right_arm_robotic",    label: "Robotic",        img: `${CDN}/right_arm_right_arm_robotic.webp`,                         promptVal: "high-tech robotic cybernetic right arm" },
          { id: "right_arm_mechanical", label: "Mechanical",     img: `${CDN}/right_arm_right_arm_mechanical.webp`,                      promptVal: "heavy industrial mechanical right arm" },
          { id: "right_arm_cute",       label: "Cute Prosthetic",img: `${CDN}/right_arm_make_right_arm_stylish_pink_prosthetic_w.webp`, promptVal: "stylish pink prosthetic right arm with custom art" },
          { id: "right_arm_prosthetic", label: "Prosthetic",     img: `${CDN}/right_arm_right_arm_prosthetic.webp`,                      promptVal: "sleek prosthetic right arm" },
          { id: "right_arm_none",       label: "None",           img: `${CDN}/right_arm_right_arm_none.webp`,                            promptVal: "no right arm" },
        ],
      },
      {
        id: "left_leg",
        label: "Left Leg",
        options: [
          { id: "left_leg_normal",     label: "Normal",         img: `${CDN}/left_leg_left_leg_normal.webp`,                          promptVal: "normal left leg" },
          { id: "left_leg_robotic",    label: "Robotic",        img: `${CDN}/left_leg_left_leg_robotic.webp`,                         promptVal: "cybernetic robotic left leg" },
          { id: "left_leg_mechanical", label: "Mechanical",     img: `${CDN}/left_leg_left_leg_mechanical.webp`,                      promptVal: "mechanical exo-frame left leg" },
          { id: "left_leg_cute",       label: "Cute Prosthetic",img: `${CDN}/left_leg_make_left_leg_stylish_pink_prosthetic_wi.webp`, promptVal: "custom styled artistic prosthetic left leg" },
          { id: "left_leg_prosthetic", label: "Prosthetic",     img: `${CDN}/left_leg_left_leg_prosthetic.webp`,                      promptVal: "modern carbon-fiber prosthetic left leg" },
          { id: "left_leg_none",       label: "None",           img: `${CDN}/left_leg_left_leg_none.webp`,                            promptVal: "no left leg" },
        ],
      },
      {
        id: "right_leg",
        label: "Right Leg",
        options: [
          { id: "right_leg_normal",     label: "Normal",         img: `${CDN}/right_leg_right_leg_normal.webp`,                         promptVal: "normal right leg" },
          { id: "right_leg_robotic",    label: "Robotic",        img: `${CDN}/right_leg_right_leg_robotic.webp`,                        promptVal: "cybernetic robotic right leg" },
          { id: "right_leg_mechanical", label: "Mechanical",     img: `${CDN}/right_leg_right_leg_mechanical.webp`,                     promptVal: "mechanical exo-frame right leg" },
          { id: "right_leg_cute",       label: "Cute Prosthetic",img: `${CDN}/right_leg_make_right_leg_stylish_pink_prosthetic_w.webp`, promptVal: "custom styled artistic prosthetic right leg" },
          { id: "right_leg_prosthetic", label: "Prosthetic",     img: `${CDN}/right_leg_right_leg_prosthetic.webp`,                     promptVal: "modern carbon-fiber prosthetic right leg" },
          { id: "right_leg_none",       label: "None",           img: `${CDN}/right_leg_right_leg_none.webp`,                           promptVal: "no right leg" },
        ],
      },
    ],
  },
  style: {
    label: "Style & Framing",
    subcategories: [
      {
        id: "rendering_style",
        label: "Rendering Style",
        options: [
          { id: "style_hyper_realistic", label: "Photorealistic",  img: `${CDN}/character_type_human.webp`,  promptVal: "hyper-realistic 8k cinematic photograph" },
          { id: "style_anime",           label: "Anime Art",       img: `${CDN}/character_type_elf.webp`,    promptVal: "masterpiece anime character design, clean vibrant lineart" },
          { id: "style_cartoon",         label: "3D Animation",    img: `${CDN}/character_type_mantis.webp`, promptVal: "3D animated feature film character render, Unreal Engine 5" },
          { id: "style_2d",              label: "2D Concept Art",  img: `${CDN}/character_type_alien.webp`,  promptVal: "2D stylized concept art illustration" },
        ],
      },
      {
        id: "framing",
        label: "Framing & Angle",
        options: [
          { id: "framing_portrait", label: "Portrait",   img: `${CDN}/character_type_human.webp`,  promptVal: "close-up character portrait, focused on head and detailed facial expression" },
          { id: "framing_upper",    label: "Upper Body", img: `${CDN}/character_type_elf.webp`,    promptVal: "upper-body character portrait, dynamic pose, expressive gesture" },
          { id: "framing_full",     label: "Full Body",  img: `${CDN}/character_type_reptile.webp`,promptVal: "full-body character concept art, complete standing pose, dynamic stance" },
          { id: "framing_sheet",    label: "Model Sheet",img: `${CDN}/character_type_alien.webp`,  promptVal: "character turnaround model sheet, front view, side view and back view, concept art model sheet" },
        ],
      },
      {
        id: "outfit_preset",
        label: "Outfit & Gear",
        options: [
          { id: "outfit_cyber",    label: "Cyber Armor",    img: `${CDN}/accessories_accessory_cyber.webp`,   promptVal: "wearing high-tech cyberpunk tactical exoskeleton armor with glowing conduits" },
          { id: "outfit_fantasy",  label: "Fantasy Robes",  img: `${CDN}/accessories_accessory_symbols.webp`, promptVal: "wearing ornate fantasy adventurer armor with flowing decorative enchanted fabrics" },
          { id: "outfit_scifi",    label: "Sci-Fi Exosuit", img: `${CDN}/left_arm_left_arm_robotic.webp`,     promptVal: "wearing advanced sci-fi pressurized space explorer exosuit with sleek mechanical joints" },
          { id: "outfit_street",   label: "Tech Streetwear",img: `${CDN}/accessories_accessory_piercing.webp`,promptVal: "wearing modern oversized urban techwear jacket with utility straps and aesthetic streetwear details" },
          { id: "outfit_oriental", label: "Eastern Hanfu",  img: `${CDN}/character_type_human.webp`,          promptVal: "wearing elegant eastern martial robe, flowing silk and embroidered patterns" },
          { id: "outfit_casual",   label: "Minimal Casual", img: `${CDN}/character_type_elf.webp`,            promptVal: "wearing clean minimalist contemporary clothing, natural aesthetic fit" },
        ],
      },
      {
        id: "backdrop",
        label: "Atmosphere & Backdrop",
        options: [
          { id: "backdrop_studio",    label: "Studio Plain", img: `${CDN}/character_type_human.webp`,       promptVal: "isolated on clean solid studio dark backdrop, volumetric rim light, easy to isolate" },
          { id: "backdrop_cyberpunk", label: "Cyber City",   img: `${CDN}/accessories_accessory_cyber.webp`, promptVal: "atmospheric futuristic neon-lit cyberpunk city alley backdrop, wet rainy reflections" },
          { id: "backdrop_fantasy",   label: "Fantasy Realm",img: `${CDN}/horns_antlers.webp`,              promptVal: "mystical ancient fantasy ruins background, glowing magical flora, floating embers" },
          { id: "backdrop_scifi",     label: "Sci-Fi Lab",   img: `${CDN}/eyes_type_eyes_mechanical.webp`,   promptVal: "high-tech spaceship interior laboratory backdrop with holographic panels" },
          { id: "backdrop_nature",    label: "Wild Nature",  img: `${CDN}/character_type_amphibian.webp`,    promptVal: "atmospheric misty cinematic landscape background, dramatic wilderness scenery" },
        ],
      },
      {
        id: "hair",
        label: "Hair / Head Growth",
        options: [
          { id: "hair_bald",      label: "Bald",       img: `${CDN}/hair_hair_bald.webp`,      promptVal: "bald head" },
          { id: "hair_short",     label: "Short Hair", img: `${CDN}/hair_hair_short.webp`,     promptVal: "short hair" },
          { id: "hair_long",      label: "Long Hair",  img: `${CDN}/hair_hair_long.webp`,      promptVal: "long flowing hair" },
          { id: "hair_afro",      label: "Afro",       img: `${CDN}/hair_hair_afro.webp`,      promptVal: "afro hairstyle" },
          { id: "hair_punk",      label: "Punk",       img: `${CDN}/hair_hair_punk.webp`,      promptVal: "punk mohawk hairstyle" },
          { id: "hair_fur",       label: "Fur / Mane", img: `${CDN}/hair_hair_fur.webp`,       promptVal: "fur mane on head" },
          { id: "hair_tentacles", label: "Tentacles",  img: `${CDN}/hair_hair_tentacles.webp`, promptVal: "tentacles as hair" },
          { id: "hair_spines",    label: "Spines",     img: `${CDN}/hair_hair_spines.webp`,    promptVal: "spines as hair" },
        ],
      },
      {
        id: "accessories",
        label: "Accessories & Markings",
        options: [
          { id: "accessory_none",          label: "None",               img: `${CDN}/character_type_human.webp`,               promptVal: "" },
          { id: "accessory_cyber",         label: "Cyber Markings",     img: `${CDN}/accessories_accessory_cyber.webp`,         promptVal: "cyberpunk circuit markings" },
          { id: "accessory_tattoos",       label: "Tattoos",            img: `${CDN}/accessories_accessory_tattoos.webp`,       promptVal: "covered in detailed tattoos" },
          { id: "accessory_piercing",      label: "Piercings",          img: `${CDN}/accessories_accessory_piercing.webp`,      promptVal: "multiple piercings" },
          { id: "accessory_scarification", label: "Scarification",      img: `${CDN}/accessories_accessory_scarification.webp`, promptVal: "ritual scarification marks" },
          { id: "accessory_symbols",       label: "Symbols / Markings", img: `${CDN}/accessories_accessory_symbols.webp`,       promptVal: "symbolic tribal markings" },
        ],
      },
    ],
  },
};

// ─── SVG Icon Components ────────────────────────────────────────────────────
const ShuffleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
    <polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" />
  </svg>
);
const SparklesIcon = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);
const ChevronDownIcon = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const CheckIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

// ─── Hover Pill — shows label, reveals image on hover ───────────────────────
function HoverPill({ label, img, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="relative shrink-0"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hovered && img && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none"
          style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.6))" }}
        >
          <div className="w-[72px] h-[72px] rounded-xl overflow-hidden border border-line-strong bg-overlay"
            style={{ transform: "rotate(-3deg)" }}>
            <img src={img} alt={label} className="w-full h-full object-cover" />
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={onClick}
        className="h-6 px-2.5 rounded-full bg-wash hover:bg-wash-strong active:scale-[0.98] active:duration-instant border border-line-subtle text-[11px] font-medium text-ink-muted hover:text-ink whitespace-nowrap transition-[background-color,border-color,color,transform] duration-fast ease-standard cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
      >
        {label}
      </button>
    </div>
  );
}

// ─── Main Component: Character Designer ─────────────────────────────────────
export default function AiInfluencerStudio({
  apiKey,
  onGenerate,
  onGenerationStart,
  onGenerationEnd,
  onGenerationComplete,
  onGenerationError,
  isGenerating: externalIsGenerating,
  signedIn = true,
  onRequireAuth,
  locale = "en",
}) {
  const copy = resolveCopy(en, AI_INFLUENCER_MESSAGES, locale);
  const [activeTab, setActiveTab] = useState("face");

  // Dynamic active models state
  const [activeModels, setActiveModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef(null);

  const [selectedOptions, setSelectedOptions] = useState(() => {
    const init = {};
    Object.values(TABS_CONFIG).forEach((tab) =>
      tab.subcategories.forEach((sub) => {
        if (sub.options?.length > 0) init[sub.id] = sub.options[0].id;
      })
    );
    return init;
  });

  const [aspectRatio, setAspectRatio] = useState("3:4");
  const [customPrompt, setCustomPrompt] = useState("");
  const [isGeneratingInternal, setIsGeneratingInternal] = useState(false);
  const [currentResult, setCurrentResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedHistoryIdx, setSelectedHistoryIdx] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const isGenerating = externalIsGenerating || isGeneratingInternal;

  // ── Fetch active image models from backend ─────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    fetch("/api/models/active?schemaVersion=2&nocache=1")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !Array.isArray(data?.models)) return;
        applyActiveModelDirectory(data.models);
        const imageModels = data.models.filter(
          (m) => (m.category === "image" || m.type === "image") && m.isActive !== false
            && m.isVisible !== false && m.autoRouteEligible !== false && m.hasWorkingRoute !== false
        );
        setActiveModels(imageModels);
        setSelectedModelId((prev) => imageModels.some((m) => m.id === prev)
          ? prev : imageModels[0]?.id || null);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target)) {
        setIsModelDropdownOpen(false);
      }
    }
    if (isModelDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isModelDropdownOpen]);

  // Selected model details
  const selectedModelMeta = useMemo(() => {
    return activeModels.find((m) => m.id === selectedModelId) || null;
  }, [activeModels, selectedModelId]);

  // ── Build prompt for Character Designer ───────────────────────────────────
  const buildPrompt = useCallback(() => {
    const parts = [];
    Object.values(TABS_CONFIG).forEach((tab) =>
      tab.subcategories.forEach((sub) => {
        const opt = sub.options.find((o) => o.id === selectedOptions[sub.id]);
        if (opt?.promptVal && opt.promptVal.trim()) parts.push(opt.promptVal.trim());
      })
    );

    // Style-specific base prompt
    const styleId = selectedOptions["rendering_style"];
    let basePrompt = "masterpiece, high-end original character concept design, cinematic lighting, ultra-detailed, 8k resolution, sharp focus";
    if (styleId === "style_anime") {
      basePrompt = "masterpiece, stunning anime character concept design, clean sharp linework, vibrant coloring, key visual, pixiv trending, aesthetic anime art";
    } else if (styleId === "style_cartoon") {
      basePrompt = "masterpiece, 3D animated character design, Pixar aesthetic, Unreal Engine 5 render, expressive lighting, polished textures";
    } else if (styleId === "style_2d") {
      basePrompt = "masterpiece, stylized 2D graphic concept art, dynamic line art, artistic fantasy character illustration";
    } else if (styleId === "style_hyper_realistic") {
      basePrompt = "masterpiece, ultra-detailed 8k photograph, photorealistic character portrait, volumetric rim lighting, sharp focus, octane render";
    }

    let finalPrompt = basePrompt;
    if (parts.length > 0) finalPrompt += ", " + parts.join(", ");
    if (customPrompt.trim()) finalPrompt += ", " + customPrompt.trim();
    return finalPrompt;
  }, [selectedOptions, customPrompt]);

  // ── Option selection ───────────────────────────────────────────────────────
  const handleOptionSelect = (subcatId, optId) =>
    setSelectedOptions((p) => ({ ...p, [subcatId]: optId }));

  // ── Shuffle all options randomly ───────────────────────────────────────────
  const handleShuffle = () => {
    const next = {};
    Object.values(TABS_CONFIG).forEach((tab) =>
      tab.subcategories.forEach((sub) => {
        if (sub.options?.length > 0)
          next[sub.id] = sub.options[Math.floor(Math.random() * sub.options.length)].id;
      })
    );
    setSelectedOptions(next);
  };

  // ── Generate ──────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (isGenerating) return;

    if (!signedIn && onRequireAuth) {
      onRequireAuth();
      return;
    }

    const workingModel = activeModels.find((model) => model.id === selectedModelId) || activeModels[0];
    if (!workingModel) {
      setErrorMsg(copy.errors?.noActiveModels || "当前暂无可用的图像模型，请稍后重试。");
      return;
    }
    const targetModel = workingModel.id;
    if (targetModel !== selectedModelId) setSelectedModelId(targetModel);

    onGenerationStart?.();
    setIsGeneratingInternal(true);
    setErrorMsg("");

    const prompt = buildPrompt();
    try {
      let res;
      if (onGenerate) {
        res = await onGenerate({
          model: targetModel,
          prompt,
          aspectRatio,
          selections: selectedOptions,
        });
      } else {
        res = await generateImage(apiKey, {
          model: targetModel,
          prompt,
          aspect_ratio: aspectRatio,
        });
      }

      if (res?.url) {
        setCurrentResult(res.url);
        setHistory((prev) => [{ url: res.url, prompt, ts: Date.now() }, ...prev]);
        setSelectedHistoryIdx(0);
        onGenerationComplete?.({
          url: res.url,
          model: targetModel,
          prompt,
          type: "image",
        });
      }
    } catch (err) {
      const message = formatErrorMessage(err, copy.errors?.generationFailed || "生成失败，请重试。");
      setErrorMsg(message);
      if (onGenerationError) onGenerationError(message);
      else toast.error(message);
    } finally {
      setIsGeneratingInternal(false);
      onGenerationEnd?.();
    }
  };

  // ── Download helper ───────────────────────────────────────────────────────
  const downloadImg = async (url) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `character-${Date.now()}.webp`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, "_blank");
    }
  };

  const previewUrl =
    selectedHistoryIdx !== null && history[selectedHistoryIdx]
      ? history[selectedHistoryIdx].url
      : currentResult;

  const arMap = { "3:4": "3/4", "1:1": "1/1", "9:16": "9/16", "16:9": "16/9" };

  // ── Collect selected tags for bottom bar ──────────────────────────────────
  const selectedTags = [];
  Object.keys(TABS_CONFIG).forEach((tabKey) => {
    TABS_CONFIG[tabKey].subcategories.forEach((sub) => {
      const selId = selectedOptions[sub.id];
      const opt = sub.options.find((o) => o.id === selId);
      if (opt && opt.promptVal) {
        selectedTags.push({ subcatId: sub.id, label: opt.label, img: opt.img });
      }
    });
  });

  const [showAllTags, setShowAllTags] = useState(false);
  const TAGS_VISIBLE = 7;

  return (
    <div className="flex h-full bg-transparent text-ink overflow-hidden select-none font-sans">

      {/* ════════════════════════════════════════════════════════════
          LEFT — Character Builder Panel
      ════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col w-[320px] shrink-0 border-r border-line bg-surface overflow-hidden">

        {/* Builder header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-ink tracking-tight">{copy.builder.title}</span>
          </div>
          <button
            onClick={() => setSelectedOptions((() => {
              const init = {};
              Object.values(TABS_CONFIG).forEach((tab) =>
                tab.subcategories.forEach((sub) => {
                  if (sub.options?.length > 0) init[sub.id] = sub.options[0].id;
                })
              );
              return init;
            })())}
            className="text-[11px] text-ink-muted hover:text-ink active:scale-[0.98] active:duration-instant transition-[color,transform] duration-fast ease-standard font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
          >
            {copy.builder.reset}
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1 px-3 py-2 border-b border-line shrink-0">
          {Object.keys(TABS_CONFIG).map((key) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-1.5 rounded-lg text-[12px] font-medium transition-[background-color,color,border-color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring ${
                activeTab === key
                  ? "bg-raised text-ink border border-line-subtle shadow-elevation-1"
                  : "text-ink-muted hover:text-ink hover:bg-wash"
              }`}
            >
              {copy.categoryTabs[key] || TABS_CONFIG[key].label}
            </button>
          ))}
        </div>

        {/* Subcategory options scroll area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {TABS_CONFIG[activeTab]?.subcategories?.map((subcat) => (
            <div key={subcat.id}>
              <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-wider mb-2 px-0.5">
                {copy.subcategories[subcat.id] || subcat.label}
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {subcat.options?.map((opt) => {
                  const sel = selectedOptions[subcat.id] === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleOptionSelect(subcat.id, opt.id)}
                      className={`group relative aspect-square rounded-xl overflow-hidden border transition-[border-color,background-color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring ${
                        sel
                          ? "border-brand-line ring-1 ring-brand-ring shadow-elevation-1"
                          : "border-line-subtle hover:border-line hover:bg-wash"
                      }`}
                    >
                      <img
                        src={opt.img}
                        alt={opt.label}
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.onerror = null; e.target.src = `${CDN}/character_type_human.webp`; }}
                      />
                      {/* Label overlay */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-4 pb-1 px-1">
                        <span className="text-[9px] font-medium text-white leading-none">{opt.label}</span>
                      </div>
                      {/* Selected check badge */}
                      {sel && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-brand text-ink-on-accent flex items-center justify-center shadow-elevation-1">
                          <CheckIcon />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          CENTER — Character Workspace & Preview
      ════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-transparent">

        {/* Center top bar: Aspect Ratio + Model Selector + Actions */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-line shrink-0 bg-base">
          {/* Aspect ratio segmented pills */}
          <div
            className="flex items-center gap-0.5 bg-surface border border-line-subtle rounded-full p-0.5 h-8"
            data-pill-segmented="true"
          >
            {["3:4", "1:1", "9:16", "16:9"].map((r) => (
              <button
                key={r}
                onClick={() => setAspectRatio(r)}
                data-pill-segment-item="true"
                className={`px-2.5 h-6.5 flex items-center rounded-full text-[11px] transition-[background-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring ${
                  aspectRatio === r
                    ? "bg-surface-inverse text-ink-inverse shadow-elevation-1 font-semibold"
                    : "text-ink-muted hover:text-ink font-medium"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Model Selector dropdown */}
            <div className="relative" ref={modelDropdownRef}>
              <button
                type="button"
                onClick={() => setIsModelDropdownOpen((v) => !v)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-surface border border-line hover:border-line-strong active:scale-[0.98] active:duration-instant text-ink text-[12px] font-medium transition-[background-color,border-color,color,transform] duration-fast ease-standard cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
              >
                <SparklesIcon className="w-3.5 h-3.5 text-brand" />
                <span className="max-w-[130px] truncate">
                  {selectedModelMeta?.displayName || selectedModelMeta?.name || copy.errors?.noActiveModels || "暂无可用模型"}
                </span>
                {selectedModelMeta?.creditsPrice != null && (
                  <span className="px-1.5 py-0.5 rounded-full bg-brand-soft text-brand text-[10px] font-mono font-medium">
                    {selectedModelMeta.creditsPrice} {copy.toolbar?.credits || "算力"}
                  </span>
                )}
                <ChevronDownIcon className="w-3.5 h-3.5 text-ink-muted" />
              </button>

              {isModelDropdownOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-64 max-h-72 overflow-y-auto rounded-xl bg-overlay border border-line-strong shadow-elevation-3 z-dropdown p-1.5 flex flex-col gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-2 py-1 text-[10px] font-semibold text-ink-subtle uppercase tracking-wider">
                    {copy.toolbar?.model || "生图模型"}
                  </div>
                  {activeModels.length === 0 ? (
                    <div className="py-8 text-center text-ink-subtle text-caption">
                      {copy.errors?.noActiveModels || "当前暂无可用的图像模型，请稍后重试。"}
                    </div>
                  ) : activeModels.map((m) => {
                    const isSelected = m.id === selectedModelId;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedModelId(m.id);
                          setIsModelDropdownOpen(false);
                          setErrorMsg("");
                        }}
                        className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-[12px] transition-[background-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring ${
                          isSelected
                            ? "bg-brand-soft text-brand font-medium"
                            : "hover:bg-wash-strong text-ink"
                        }`}
                      >
                        <div className="flex flex-col truncate pr-2">
                          <span className="truncate">{m.displayName || m.name || m.id}</span>
                          {m.provider && (
                            <span className="text-[10px] text-ink-disabled capitalize">{m.provider}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {m.creditsPrice != null && (
                            <span className="text-[10px] font-mono text-ink-subtle">
                              {m.creditsPrice} {copy.toolbar?.credits || "算力"}
                            </span>
                          )}
                          {isSelected && <CheckIcon />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Shuffle */}
            <button
              onClick={handleShuffle}
              className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-surface border border-line hover:border-line-strong active:scale-[0.98] active:duration-instant text-ink-muted hover:text-ink text-[12px] font-medium transition-[background-color,border-color,color,transform] duration-fast ease-standard cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
            >
              <ShuffleIcon />
              {copy.toolbar.shuffle}
            </button>

            {/* Generate Button (Brand Accent #e11d74) */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || activeModels.length === 0}
              className={`flex items-center gap-2 h-8 px-4 rounded-xl text-[12px] font-semibold transition-[background-color,color,transform] duration-fast ease-standard shadow-elevation-1 cursor-pointer active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring ${
                isGenerating
                  ? "bg-brand/50 text-ink-on-accent/60 cursor-not-allowed"
                  : "bg-brand hover:bg-brand-hover active:bg-brand-active text-ink-on-accent"
              }`}
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.3" />
                    <path d="M21 12a9 9 0 00-9-9" />
                  </svg>
                  {copy.toolbar.generating}
                </>
              ) : (
                <>
                  <SparklesIcon className="w-3.5 h-3.5" />
                  {copy.toolbar.generate}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Preview area */}
        <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
          <div
            className="relative rounded-2xl overflow-hidden bg-well border border-line shadow-elevation-2 flex items-center justify-center"
            style={{ aspectRatio: arMap[aspectRatio] ?? "3/4", maxHeight: "100%", maxWidth: "100%" }}
          >
            {isGenerating ? (
              <div className="flex flex-col items-center gap-4 text-center px-8 py-12">
                <div className="w-12 h-12 border-[3px] border-brand-line border-t-brand rounded-full animate-spin" />
                <p className="text-sm text-ink-muted font-medium">{copy.preview.generating}</p>
              </div>
            ) : previewUrl ? (
              <>
                <img src={previewUrl} alt={copy.preview.altGenerated} className="w-full h-full object-cover" />
                {/* Download overlay button */}
                <button
                  onClick={() => downloadImg(previewUrl)}
                  className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-scrim backdrop-blur-md border border-line-subtle text-ink-on-accent text-[11px] font-medium hover:bg-black/90 active:scale-[0.98] active:duration-instant transition-[background-color,transform] duration-fast ease-standard cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
                >
                  <DownloadIcon />
                  {copy.preview.save}
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center px-8 py-12">
                <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center text-ink-disabled border border-line-subtle">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <p className="text-sm text-ink-muted font-medium">{copy.preview.emptyTitle}</p>
                <p className="text-xs text-ink-subtle leading-relaxed">
                  {copy.preview.emptySubtitleLine1}<br />{copy.preview.emptySubtitleLine2}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Selected options pills bar */}
        {selectedTags.length > 0 && (
          <div className="px-6 pb-2.5 shrink-0">
            <div className="flex flex-wrap gap-1.5 items-center">
              {(showAllTags ? selectedTags : selectedTags.slice(0, TAGS_VISIBLE)).map((tag) => (
                <HoverPill
                  key={tag.subcatId}
                  label={tag.label}
                  img={tag.img}
                  onClick={() => {
                    const ownerTab = Object.keys(TABS_CONFIG).find((tk) =>
                      TABS_CONFIG[tk].subcategories.some((s) => s.id === tag.subcatId)
                    );
                    if (ownerTab) setActiveTab(ownerTab);
                  }}
                />
              ))}
              {selectedTags.length > TAGS_VISIBLE && (
                <button
                  type="button"
                  onClick={() => setShowAllTags((v) => !v)}
                  className="h-6 px-2.5 rounded-full bg-wash hover:bg-wash-strong active:scale-[0.98] active:duration-instant border border-line-subtle text-[11px] text-ink-subtle hover:text-ink whitespace-nowrap transition-[background-color,color,border-color,transform] duration-fast ease-standard cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
                >
                  {showAllTags ? copy.tags.hide : copy.tags.showMore}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Localized Error banner */}
        {errorMsg && (
          <div className="mx-6 mb-3 px-4 py-2.5 rounded-xl bg-danger-soft border border-danger-line text-danger text-[12px] flex items-center justify-between shrink-0">
            <span>{errorMsg}</span>
            <button
              onClick={() => setErrorMsg("")}
              className="text-[11px] underline opacity-80 hover:opacity-100 active:scale-[0.98] active:duration-instant transition-[opacity,transform] duration-fast ease-standard cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
            >
              ✕
            </button>
          </div>
        )}

        {/* Custom prompt input at bottom */}
        <div className="px-6 pb-4 shrink-0">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder={copy.customPrompt.placeholder}
            className="w-full h-9 bg-well border border-line rounded-xl px-3 text-[12px] text-ink placeholder:text-ink-disabled outline-none focus:border-brand-line transition-colors"
          />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          RIGHT — Generated Characters Gallery
      ════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col w-[160px] shrink-0 border-l border-line bg-surface overflow-hidden">

        {/* Gallery header */}
        <div className="px-3 py-3 border-b border-line shrink-0">
          <p className="text-[11px] font-semibold text-ink tracking-tight">{copy.gallery.title}</p>
          <p className="text-[9px] text-ink-subtle mt-0.5">{history.length} {copy.gallery.countSuffix}</p>
        </div>

        {/* Gallery scroll list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center px-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-ink-disabled mb-2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
              </svg>
              <p className="text-[9px] text-ink-subtle leading-relaxed">
                {copy.gallery.emptyText.split('\n')[0]}<br />{copy.gallery.emptyText.split('\n')[1]}
              </p>
            </div>
          ) : (
            history.map((item, idx) => (
              <div
                key={item.ts}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedHistoryIdx(idx)}
                onKeyDown={(e) => e.key === "Enter" && setSelectedHistoryIdx(idx)}
                className={`group relative w-full aspect-[3/4] rounded-xl overflow-hidden border transition-colors cursor-pointer ${
                  selectedHistoryIdx === idx
                    ? "border-brand-line ring-1 ring-brand-ring"
                    : "border-line-subtle hover:border-line"
                }`}
              >
                <img src={item.url} alt={`${copy.gallery.altPrefix} ${idx + 1}`} className="w-full h-full object-cover" />
                {/* Download and copy overlay */}
                <div className="pointer-events-none absolute inset-0 hidden items-end justify-center bg-black/50 pb-2 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 md:flex">
                  <div className="absolute right-2 top-2 flex flex-col gap-2">
                    <GenerationCopyButtons
                      prompt={item.prompt}
                      imageUrl={item.url}
                      onCopyError={onGenerationError}
                    />
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); downloadImg(item.url); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); downloadImg(item.url); } }}
                    className="p-1.5 rounded-lg bg-surface border border-line-subtle text-ink hover:bg-raised transition-colors cursor-pointer"
                  >
                    <DownloadIcon />
                  </div>
                </div>
                <MobileGenerationActions
                  prompt={item.prompt}
                  imageUrl={item.url}
                  onCopyError={onGenerationError}
                  actions={[
                    {
                      kind: "download",
                      label: copy.gallery.download,
                      onSelect: () => downloadImg(item.url),
                    },
                  ]}
                />
                {/* Index badge */}
                <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-scrim backdrop-blur-sm text-[8px] text-ink-muted font-mono font-medium">
                  #{history.length - idx}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <Toaster position="top-right" duration={5000} />
    </div>
  );
}
