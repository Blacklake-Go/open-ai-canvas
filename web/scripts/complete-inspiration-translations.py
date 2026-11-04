#!/usr/bin/env python3
import json
import os
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
PUBLIC_DIR = os.path.join(WEB_DIR, "public", "inspirations")
OUT_DIR = os.path.join(PUBLIC_DIR, "translations")
os.makedirs(OUT_DIR, exist_ok=True)

CURATED_DATA = {
  "original:雨夜霓虹 · 电影感开场": {
    "title_zh": "雨夜霓虹 · 电影感开场",
    "desc_zh": "宽银幕构图、环境反光与缓慢推进镜头",
    "prompt_zh": "雨夜城市街口，霓虹灯倒映在湿润路面，主角撑伞穿过人群，镜头从远景缓慢推进到侧脸特写，电影感光影，16:9",
    "translations": {
      "en-US": {"title": "Rainy Night Neon · Cinematic Opening", "description": "Widescreen composition, ambient reflections and slow-moving push shot", "prompt": "City street corner on a rainy night, neon lights reflecting on the wet pavement, protagonist walking through the crowd holding an umbrella, camera slowly pushing from long shot to side close-up, cinematic lighting, 16:9"},
      "zh-TW": {"title": "雨夜霓虹 · 電影感開場", "description": "寬銀幕構圖、環境反光與緩慢推進鏡頭", "prompt": "雨夜城市街口，霓虹燈倒映在濕潤路面，主角撐傘穿過人群，鏡頭從遠景緩慢推進到側臉特寫，電影感光影，16:9"},
      "ja-JP": {"title": "雨夜のネオン · 映画的オープニング", "description": "シネマスコープ構図、環境反射とゆっくりとしたプッシュショット", "prompt": "City street corner on a rainy night, neon lights reflecting on wet pavement, protagonist holding umbrella through crowd, slow camera push to side close-up, cinematic lighting, 16:9"},
      "ko-KR": {"title": "비 내리는 밤의 네온 · 영화적 오프닝", "description": "와이드스크린 구도, 주변 반사와 서서히 전진하는 카메라 앵글", "prompt": "City street corner on a rainy night, neon lights reflecting on wet pavement, protagonist holding umbrella through crowd, slow camera push to side close-up, cinematic lighting, 16:9"},
      "es-ES": {"title": "Neón en noche lluviosa · Apertura cinematográfica", "description": "Composición en pantalla ancha, reflejos ambientales y toma de aproximación lenta", "prompt": "City street corner on a rainy night, neon lights reflecting on wet pavement, protagonist holding umbrella through crowd, slow camera push to side close-up, cinematic lighting, 16:9"}
    }
  },
  "original:港风天台重逢": {
    "title_zh": "港风天台重逢",
    "desc_zh": "复古色彩与克制的人物情绪",
    "prompt_zh": "九十年代港风天台，黄昏逆光，两位多年未见的旧友隔着晾衣绳对望，风吹动衣角，镜头轻微手持并缓慢靠近",
    "translations": {
      "en-US": {"title": "Hong Kong Rooftop Reunion", "description": "Retro colors and understated character emotions", "prompt": "1990s Hong Kong style rooftop, backlit at dusk, two old friends unseen for years looking at each other across clotheslines, wind fluttering clothes, camera slightly handheld and slowly approaching"},
      "zh-TW": {"title": "港風天台重逢", "description": "復古色彩與克制的人物情緒", "prompt": "九十年代港風天台，黃昏逆光，兩位多年未見的舊友隔著晾衣繩對望，風吹動衣角，鏡頭輕微手持並緩慢靠近"},
      "ja-JP": {"title": "香港レトロ屋上での再会", "description": "レトロな色彩と抑えられた感情表現", "prompt": "1990s Hong Kong style rooftop, backlit at dusk, two old friends unseen for years looking across clothesline, wind fluttering clothes, handheld camera slowly approaching"},
      "ko-KR": {"title": "홍콩 스타일 옥상 재회", "description": "레트로 색채와 절제된 인물 감정선", "prompt": "1990s Hong Kong style rooftop, backlit at dusk, two old friends unseen for years looking across clothesline, wind fluttering clothes, handheld camera slowly approaching"},
      "es-ES": {"title": "Reencuentro en azotea estilo Hong Kong", "description": "Colores retro y emociones contenidas", "prompt": "1990s Hong Kong style rooftop, backlit at dusk, two old friends looking across clothesline, wind fluttering clothes, handheld camera slowly approaching"}
    }
  },
  "original:暗巷悬疑追逐": {
    "title_zh": "暗巷悬疑追逐",
    "desc_zh": "高反差黑色电影与紧张节奏",
    "prompt_zh": "黑白悬疑电影风格，侦探在狭窄暗巷中追逐神秘人，路灯切割出强烈明暗，低机位跟拍，节奏逐渐加快",
    "translations": {
      "en-US": {"title": "Dark Alley Suspense Chase", "description": "High-contrast film noir and tense pacing", "prompt": "Black and white suspense film noir, detective chasing a mysterious figure in a narrow dark alley, streetlights cutting sharp contrast, low-angle tracking shot, accelerating rhythm"},
      "zh-TW": {"title": "暗巷懸疑追逐", "description": "高反差黑色電影與緊張節奏", "prompt": "黑白懸疑電影風格，偵探在狹窄暗巷中追逐神秘人，路燈切割出強烈明暗，低機位跟拍，節奏逐漸加快"},
      "ja-JP": {"title": "路地裏のサスペンスチェイス", "description": "ハイコントラストなフィルム・ノワールと緊張感あるテンポ", "prompt": "Black and white suspense film noir, detective chasing mysterious figure in dark alley, sharp streetlight contrast, low-angle tracking shot, accelerating rhythm"},
      "ko-KR": {"title": "골목길 서스펜스 추격전", "description": "고대비 필름 느와르와 긴박한 호흡", "prompt": "Black and white suspense film noir, detective chasing mysterious figure in dark alley, sharp streetlight contrast, low-angle tracking shot, accelerating rhythm"},
      "es-ES": {"title": "Persecución de suspense en callejón oscuro", "description": "Cine negro de alto contraste y ritmo tenso", "prompt": "Black and white suspense film noir, detective chasing mysterious figure in dark alley, sharp streetlight contrast, low-angle tracking shot, accelerating rhythm"}
    }
  },
  "original:东方幻想角色设定": {
    "title_zh": "东方幻想角色设定",
    "desc_zh": "角色概念图与细腻材质表达",
    "prompt_zh": "东方幻想世界的年轻女剑客角色设定，银白发饰、层叠轻甲与红色披风，山雾背景，细腻材质，电影级概念设计",
    "translations": {
      "en-US": {"title": "Eastern Fantasy Character Concept", "description": "Character concept art with intricate textures", "prompt": "Young female swordsman character concept in an eastern fantasy world, silver-white hair accessories, layered light armor and red cloak, mountain mist background, detailed textures, cinematic concept design"},
      "zh-TW": {"title": "東方幻想角色設定", "description": "角色概念圖與細膩材質表達", "prompt": "東方幻想世界的年輕女劍客角色設定，銀白髮飾、層疊輕甲與紅色披風，山霧背景，細膩材質，電影級概念設計"},
      "ja-JP": {"title": "東洋ファンタジーキャラクター設定", "description": "キャラクターコンセプトアートと繊細な質感", "prompt": "Young female swordsman concept in eastern fantasy world, silver-white hair accessories, layered light armor and red cape, mountain mist background, detailed textures, cinematic concept design"},
      "ko-KR": {"title": "동양 판타지 캐릭터 콘셉트", "description": "캐릭터 콘셉트 아트와 섬세한 질감 묘사", "prompt": "Young female swordsman concept in eastern fantasy world, silver-white hair accessories, layered light armor and red cape, mountain mist background, detailed textures, cinematic concept design"},
      "es-ES": {"title": "Concepto de personaje de fantasía oriental", "description": "Arte conceptual de personaje con texturas refinadas", "prompt": "Young female swordsman concept in eastern fantasy world, silver-white hair accessories, layered light armor and red cape, mountain mist background, detailed textures, cinematic concept design"}
    }
  },
  "original:温暖室内对话": {
    "title_zh": "温暖室内对话",
    "desc_zh": "生活化场景与柔和叙事氛围",
    "prompt_zh": "请帮我写一场发生在暖色灯光客厅里的母女对话戏：女儿准备离开家乡，母亲表面平静但一直在整理旧物，用动作和潜台词推进情绪。",
    "translations": {
      "en-US": {"title": "Warm Indoor Dialogue", "description": "Slice-of-life setting with gentle narrative mood", "prompt": "Please write a mother-daughter conversation in a warm-lit living room: daughter is preparing to leave hometown, mother appears calm while tidying up old belongings, driving emotions through actions and subtext."},
      "zh-TW": {"title": "溫暖室內對話", "description": "生活化場景與柔和敘事氛圍", "prompt": "請幫我寫一場發生在暖色燈光客廳裡的母女對話戲：女兒準備離開家鄉，母親表面平靜但一直在整理舊物，用動作和潛台詞推進情緒。"},
      "ja-JP": {"title": "温かい室内の対話", "description": "日常のワンシーンと穏やかな物語の雰囲気", "prompt": "温かい照明のリビングルームで、母と娘の会話シーンを執筆してください。故郷を離れる娘と、平静を装いながら古い荷物を片付ける母親の感情を、動作とサブテキストで表現してください。"},
      "ko-KR": {"title": "따뜻한 실내 대화", "description": "일상적인 배경과 은은한 서사 분위기", "prompt": "따뜻한 조명의 거실에서 펼쳐지는 모녀의 대화 장면을 작성해 주세요. 고향을 떠나려는 딸과 평온해 보이지만 옛 물건을 정리하는 어머니의 감정을 행동과 서브텍스트로 이끌어내 주세요."},
      "es-ES": {"title": "Diálogo cálido en interiores", "description": "Escena cotidiana con atmósfera narrativa suave", "prompt": "Escribe una escena de diálogo entre madre e hija en una sala con luz cálida: la hija se prepara para dejar su ciudad natal, mientras la madre finge calma ordenando cosas viejas, guiando la emoción a través de acciones y subtexto."}
    }
  },
  "chatgpt-prompts:森林里的最后一封信": {
    "title_zh": "森林里的最后一封信",
    "desc_zh": "童话叙事 · 从角色愿望建立冲突",
    "prompt_zh": "作为故事讲述者，为亲子观众写一个关于坚持的森林童话。主角是一只替动物送信的小狐狸，它必须在第一场雪之前送出一封没有地址的信。先给出角色的愿望与阻碍，再设计三个递进的事件，最后用一个可见的行动完成情绪转折。避免说教。",
    "translations": {
      "en-US": {"title": "The Last Letter in the Forest", "description": "Fairytale narrative · Conflict built from character desires", "prompt": "As a storyteller, write a forest fairytale about perseverance for families. The protagonist is a little fox delivering letters for animals who must deliver an addressless letter before first snow. Set up desire and obstacles, then three escalating events, and resolve emotion through a visible action without preaching."},
      "zh-TW": {"title": "森林裡的最後一封信", "description": "童話敘事 · 從角色願望建立衝突", "prompt": "作為故事講述者，為親子觀眾寫一個關於堅持的森林童話。主角是一隻替動物送信的小狐狸，它必須在第一場雪之前送出一封沒有地址的信。先給出角色的願望與阻礙，再設計三個遞進的事件，最後用一個可見的行動完成情緒轉折。避免說教。"},
      "ja-JP": {"title": "森の最後の手紙", "description": "おとぎ話の語り · キャラクターの願いから生まれる葛藤", "prompt": "ストーリーテラーとして、親子の読者に向けた粘り強さを描く森のおとぎ話を書いてください。動物たちに手紙を届ける小さなキツネが、初雪が降る前に宛名のない手紙を届けなければなりません。"},
      "ko-KR": {"title": "숲속의 마지막 편지", "description": "동화 서사 · 캐릭터의 바람에서 시작되는 갈등", "prompt": "이야기꾼으로서 가족 관객을 위한 끈기에 관한 숲속 동화를 작성해 주세요. 동물들에게 편지를 전하는 작은 여우가 첫눈이 오기 전에 주소 없는 편지를 전해야 합니다."},
      "es-ES": {"title": "La última carta del bosque", "description": "Narrativa de cuento de hadas · Conflicto desde el deseo del personaje", "prompt": "Como narrador, escribe un cuento infantil sobre la perseverancia. El protagonista es un pequeño zorro cartero que debe entregar una carta sin dirección antes de la primera nevada."}
    }
  },
  "chatgpt-prompts:末班车上的陌生人": {
    "title_zh": "末班车上的陌生人",
    "desc_zh": "短剧编剧 · 让对白藏住真正目的",
    "prompt_zh": "作为编剧，设计一段发生在末班公交车上的三分钟短剧。两位陌生人都声称自己丢失了一本笔记，但只有一人说真话。先定义人物动机、场景限制和各自隐瞒的信息，再写动作、对白与反转结尾。全剧限制两个角色、一个场景，适合低成本实拍。",
    "translations": {
      "en-US": {"title": "Strangers on the Last Bus", "description": "Short drama screenwriting · Concealing intent through dialogue", "prompt": "As a screenwriter, design a 3-minute short drama set on the last bus of the night. Two strangers both claim they lost a notebook, but only one is telling the truth. Define motives, constraints, concealed secrets, then actions, dialogue and a twist ending for low-cost filming with two actors in one scene."},
      "zh-TW": {"title": "末班車上的陌生人", "description": "短劇編劇 · 讓對白藏住真正目的", "prompt": "作為編劇，設計一段發生在末班公車上的三分鐘短劇。兩位陌生人都聲稱自己遺失了一本筆記，但只有一人說真話。先定義人物動機、場景限制和各自隱瞞的資訊，再寫動作、對白與反轉結尾。全劇限制兩個角色、一個場景，適合低成本實拍。"},
      "ja-JP": {"title": "最終バスの見知らぬ二人", "description": "ショートドラマ脚本 · 対話の裏に真意を隠す", "prompt": "脚本家として、最終バス車内を舞台にした3分間のショートドラマを構成してください。ノートを失くしたと主張する二人の見知らぬ乗客のうち、本当のことを言っているのは一人だけです。"},
      "ko-KR": {"title": "막차의 낯선 사람들", "description": "단편 드라마 극작 · 대사 속에 숨겨진 진짜 목적", "prompt": "극작가로서 심야 막차 버스에서 일어나는 3분 분량의 숏폼 드라마를 기획해 주세요. 잃어버린 수첩을 찾는 두 명의 낯선 사람 중 단 한 명만이 진실을 말하고 있습니다."},
      "es-ES": {"title": "Extraños en el último autobús", "description": "Guion de microdrama · Diálogos con intenciones ocultas", "prompt": "Como guionista, diseña un microdrama de 3 minutos en el último autobús nocturno. Dos extraños afirman haber perdido una libreta, pero solo uno dice la verdad. Plantea motivaciones, secretos, diálogo y giro final."}
    }
  },
  "chatgpt-prompts:未来城市的记忆修补师": {
    "title_zh": "未来城市的记忆修补师",
    "desc_zh": "科幻大纲 · 世界规则与人物代价",
    "prompt_zh": "作为小说家，构思一部关于记忆修补师的未来都市短篇。城市居民能删除痛苦记忆，但主角发现每次删除都会遗失一种颜色。建立三条世界规则、主人公的核心缺陷、五个转折和付出代价的结局。先交付故事大纲，不直接铺写长篇。",
    "translations": {
      "en-US": {"title": "Memory Mender in the Future City", "description": "Sci-fi outline · World rules and personal sacrifices", "prompt": "As a novelist, outline a sci-fi short story about a memory mender in a future metropolis. Citizens can erase painful memories, but the protagonist discovers every deletion loses a specific color in their perception. Establish three world rules, the protagonist's core flaw, five plot turns, and a costly ending outline."},
      "zh-TW": {"title": "未來城市的記憶修補師", "description": "科幻大綱 · 世界規則與人物代價", "prompt": "作為小說家，構思一部關於記憶修補師的未來都市短篇。城市居民能刪除痛苦記憶，但主角發現每次刪除都會遺失一種顏色。建立三條世界規則、主人公的核心缺陷、五個轉折和付出代價的結局。先交付故事大綱，不直接鋪寫長篇。"},
      "ja-JP": {"title": "未来都市の記憶修復士", "description": "SFプロット · 世界の法則と払うべき代償", "prompt": "SF作家として、未来都市の記憶修復士をテーマにした短編プロットを構築してください。痛ましい記憶を消去できる市民たちと、消去するたびに1つの色を失っていく主人公の物語です。"},
      "ko-KR": {"title": "미래 도시의 기억 수리공", "description": "SF 시놉시스 · 세계관 법칙과 인물의 대가", "prompt": "소설가로서 미래 도시의 기억 수리공에 관한 SF 단편 시놉시스를 구상해 주세요. 고통스러운 기억을 지울 때마다 세상의 색을 하나씩 잃어버리는 주인공의 이야기입니다."},
      "es-ES": {"title": "El remendador de recuerdos en la ciudad del futuro", "description": "Sinopsis de ciencia ficción · Reglas del mundo y sacrificios personales", "prompt": "Como novelista, concibe un relato de ciencia ficción sobre un reparador de recuerdos en una metrópoli futura. Cada vez que borra un recuerdo doloroso, pierde la percepción de un color."}
    }
  },
  "chatgpt-prompts:把告别写成一场雨": {
    "title_zh": "把告别写成一场雨",
    "desc_zh": "诗性旁白 · 少解释，多感官细节",
    "prompt_zh": "作为诗人，为一段雨中离乡的影像写四组中文旁白，每组不超过四十字。分别使用气味、触感、声音与光线表达告别，不直接使用悲伤、不舍或想念等情绪词。用朴素、可朗读的语言，给每组留一个停顿。",
    "translations": {
      "en-US": {"title": "Writing Farewell as a Rainstorm", "description": "Poetic voiceover · Sensory details over exposition", "prompt": "As a poet, write four sets of voiceover lines for visual footage of leaving hometown in the rain, each under 40 Chinese characters or 25 English words. Express farewell through scent, touch, sound, and lighting, avoiding clichéd emotional words. Natural, recite-friendly language with intentional breath pauses."},
      "zh-TW": {"title": "把告別寫成一場雨", "description": "詩性旁白 · 少解釋，多感官細節", "prompt": "作為詩人，為一段雨中離鄉的影像寫四組中文旁白，每組不超過四十字。分別使用氣味、觸感、聲音與光線表達告別，不直接使用悲傷、不捨或想念等情緒詞。用樸素、可朗讀的語言，給每組留一個停頓。"},
      "ja-JP": {"title": "別れを雨の詩に紡ぐ", "description": "詩的なナレーション · 説明を排し五感のディテールを描く", "prompt": "詩人として、雨の中で故郷を離れる映像に重ねる4つのナレーション文を創作してください。匂い、感触、音、光を通して別れを表現し、直接的な感情語を避け、朗読しやすいリズムで綴ってください。"},
      "ko-KR": {"title": "작별을 비로 써 내려가다", "description": "시적 내레이션 · 설명 대신 감각적 디테일", "prompt": "시인으로서 빗속에서 고향을 떠나는 영상에 들어갈 4개의 내레이션을 작성해 주세요. 냄새, 촉각, 소리, 빛을 통해 작별을 전하며 직접적인 감정 단어를 피해 담담하고 낭독하기 좋은 호흡을 만들어 주세요."},
      "es-ES": {"title": "Escribir la despedida como lluvia", "description": "Voz en off poética · Menos explicación y más detalles sensoriales", "prompt": "Como poeta, escribe cuatro textos de narración en off para un viaje de despedida bajo la lluvia. Expresa el adiós mediante olores, texturas, sonidos y luces, con un tono sobrio y poético."}
    }
  },
  "chatgpt-prompts:一瓶饮料的夏日故事": {
    "title_zh": "一瓶饮料的夏日故事",
    "desc_zh": "广告策划 · 人群、主张与三个镜头",
    "prompt_zh": "作为广告策划，为面向年轻通勤者的无糖气泡饮料设计十五秒广告。定义目标人群、核心场景和一句传播主张，再给出三个镜头的画面、时长、音效与字幕。不要虚构营养或功效数据，用下班后一口清爽的体验讲故事。",
    "translations": {
      "en-US": {"title": "Summer Story in a Beverage Bottle", "description": "Advertising campaign · Audience, hook and three shots", "prompt": "As an ad strategist, design a 15-second commercial for a sugar-free sparkling drink targeted at young commuters. Define audience, core occasion, and a campaign tagline, then provide visuals, duration, sound effects, and captions for three concise shots capturing that crisp post-work relief."},
      "zh-TW": {"title": "一瓶飲料的夏日故事", "description": "廣告策劃 · 人群、主張與三個鏡頭", "prompt": "作為廣告策劃，為面向年輕通勤者的無糖氣泡飲料設計十五秒廣告。定義目標人群、核心場景和一句傳播主張，再給出三個鏡頭的畫面、時長、音效與字幕。不要虛構營養或功效數據，用下班後一口清爽的體驗講故事。"},
      "ja-JP": {"title": "一本のドリンクがつなぐ夏の物語", "description": "広告企画 · ターゲット、コアメッセージ、3カット構成", "prompt": "広告プランナーとして、若手通勤者をターゲットにした無糖炭酸飲料の15秒CMを企画してください。退勤後の爽快感をリアルに伝える3カット構成で描いてください。"},
      "ko-KR": {"title": "한 병의 음료가 담은 여름 이야기", "description": "광고 기획 · 타깃, 카피라이팅, 3개 컷 구성", "prompt": "광고 기획자로서 젊은 출퇴근 직장인을 위한 무설탕 탄산음료 15초 광고를 기획해 주세요. 퇴근 후 한 모금의 시원함이 주는 해방감을 3개의 컷으로 설계해 주세요."},
      "es-ES": {"title": "Historia de verano en una botella", "description": "Estrategia publicitaria · Audiencia, propuesta y tres tomas", "prompt": "Como publicista, diseña un anuncio de 15 segundos para una bebida con gas sin azúcar dirigida a jóvenes profesionales. Diseña tres tomas con visuales, duración y efectos que transmitan frescura."}
    }
  },
  "chatgpt-prompts:独立咖啡店的视觉语言": {
    "title_zh": "独立咖啡店的视觉语言",
    "desc_zh": "品牌创意 · 让配色和语气讲同一件事",
    "prompt_zh": "作为品牌策略师，为社区里一家安静的独立咖啡店提出三种视觉方向。品牌重视慢节奏、邻里关系和手作。每种方向包含色彩、摄影氛围、文字语气、三条社交内容主题和差异化理由。不要模仿已有连锁品牌的标识。",
    "translations": {
      "en-US": {"title": "Visual Identity for an Indie Cafe", "description": "Brand creative · Harmonizing color palettes and voice", "prompt": "As a brand strategist, propose three visual directions for a quiet neighborhood coffee shop focusing on slow living, artisan craft, and community. Each direction includes colors, photography tone, verbal voice, 3 social content themes, and reasons for distinction without copying existing chains."},
      "zh-TW": {"title": "獨立咖啡店的視覺語言", "description": "品牌創意 · 讓配色和語氣講同一件事", "prompt": "作為品牌策略師，為社區裡一家安靜的獨立咖啡店提出三種視覺方向。品牌重視慢節奏、鄰里關係和手作。每種方向包含色彩、攝影氛圍、文字語氣、三條社交內容主題和差異化理由。不要模仿已有連鎖品牌的標識。"},
      "ja-JP": {"title": "個人カフェのビジュアル言語", "description": "ブランド戦略 · 配色とトーンで統一した世界観を語る", "prompt": "ブランドストラテジストとして、地域の小さな個人経営カフェに向けた3つのビジュアル方針を提案してください。スローペース、職人技、コミュニティを大切にする世界観を定義します。"},
      "ko-KR": {"title": "독립 카페의 시각적 언어", "description": "브랜드 크리에이티브 · 컬러와 어조의 일치", "prompt": "브랜드 전략가로서 조용한 동네 독립 카페를 위한 3가지 시각적 콘셉트를 제안해 주세요. 느린 일상, 수제 제작, 이웃과의 유대를 반영한 차별화된 아이덴티티를 설계합니다."},
      "es-ES": {"title": "Lenguaje visual para cafetería independiente", "description": "Creatividad de marca · Coherencia entre paleta y tono", "prompt": "Como estratega de marca, propón tres direcciones visuales para una cafetería de barrio artesanal. Define colores, fotografía, tono de voz y propuestas de contenido únicas."}
    }
  },
  "chatgpt-prompts:给剧本做一次镜头诊断": {
    "title_zh": "给剧本做一次镜头诊断",
    "desc_zh": "创作复盘 · 从叙事到声音提出修改",
    "prompt_zh": "请以电影评论者的视角审阅我接下来提供的剧本或分镜，从叙事、人物、构图、运镜和声音五个维度提出反馈。每条意见都引用我提供的片段，并给出一个能实际拍摄的修改方案。还没有收到材料时，先向我索取，不要假装看过影片。",
    "translations": {
      "en-US": {"title": "Shot Diagnosis for Screenplays", "description": "Creative debrief · Constructive feedback from narrative to sound", "prompt": "Review my upcoming script or storyboard from a film critic perspective across five dimensions: narrative, character, composition, camera movement, and sound. Quote excerpts from my text and propose actionable, practical filming revisions."},
      "zh-TW": {"title": "給劇本做一次鏡頭診斷", "description": "創作複盤 · 從敘事到聲音提出修改", "prompt": "請以電影評論者的視角審閱我接下來提供的劇本或分鏡，從敘事、人物、構圖、運鏡和聲音五個維度提出反饋。每條意見都引用我提供的片段，並給出一個能實際拍攝的修改方案。還沒有收到材料時，先向我索取，不要假裝看過影片。"},
      "ja-JP": {"title": "脚本のカメラワーク診断", "description": "制作振り返り · 物語から音響まで多角的な改善提案", "prompt": "映画評論家の視点から、提出する脚本や絵コンテを物語、キャラクター、構図、カメラワーク、音響の5つの観点で査定し、実現可能な撮影修正案を提示してください。"},
      "ko-KR": {"title": "시나리오 연출 진단", "description": "창작 리뷰 · 서사부터 음향까지 실질적 피드백", "prompt": "영화 평론가의 관점에서 시나리오나 스토리보드를 서사, 캐릭터, 구도, 카메라 워크, 사운드 5가지 축으로 검토하고 실제 촬영 가능한 개선안을 제시해 주세요."},
      "es-ES": {"title": "Diagnóstico de planos para guion", "description": "Revisión creativa · Crítica constructiva de narrativa a sonido", "prompt": "Analiza mi guion o storyboard desde la perspectiva de un crítico de cine en cinco aspectos: narrativa, personajes, encuadre, movimiento de cámara y sonido, con propuestas de rodaje viables."}
    }
  },
  "chatgpt-prompts:旧城街景的时代考据": {
    "title_zh": "旧城街景的时代考据",
    "desc_zh": "历史场景 · 区分史实、推测和虚构",
    "prompt_zh": "作为历史研究者，协助我设计民国早期城市街景的影视场景。先问清具体年份、地点和人物阶层，再列出服饰、交通、招牌、建筑和日常用语的考据清单。明确区分有来源的史实、合理推测与戏剧性虚构，不编造文献。",
    "translations": {
      "en-US": {"title": "Period Research for Old Town Streetscapes", "description": "Historical setting · Differentiating facts, inferences and fiction", "prompt": "As a historical researcher, assist me in designing an early Republican era Chinese street scene for film and television. Inquire about year, location, and social class, then provide research checklists for clothing, transit, signs, architecture, and dialect, clearly separating sourced facts from dramatic fiction."},
      "zh-TW": {"title": "舊城街景的時代考據", "description": "歷史場景 · 區分史實、推測和虛構", "prompt": "作為歷史研究者，協助我設計民國早期城市街景的影視場景。先問清具體年份、地點和人物階層，再列出服飾、交通、招牌、建築和日常用語的考據清單。明確區分有來源的史實、合理推測與戲劇性虛構，不編造文獻。"},
      "ja-JP": {"title": "旧市街の時代考証", "description": "歴史的舞台 · 史実、推測、創作の境界を整理", "prompt": "歴史研究者として、20世紀初頭の都市街並みの時代考証を支援してください。衣装、交通、看板、建築、言葉遣いについて、史実とドラマ的創作を明確に切り分けて整理します。"},
      "ko-KR": {"title": "구도심 거리의 시대적 고증", "description": "역사적 배경 · 사실, 추정, 허구의 구분", "prompt": "역사 연구자로서 근대 초기 도시 거리의 영상 배경 디자인을 고증해 주세요. 복식, 교통, 간판, 건축, 일상 용어에 대해 출처가 명확한 사료와 극적 허구를 명확히 구분합니다."},
      "es-ES": {"title": "Investigación histórica de paisajes urbanos antiguos", "description": "Ambientación histórica · Distinguir hechos, conjeturas y ficción", "prompt": "Como historiador, ayúdame a ambientar una calle de época para cine y televisión. Desarrolla listas de vestuario, transporte, cartelería y arquitectura diferenciando hechos documentados de ficción dramática."}
    }
  },
  "original:月面独行": {
    "title_zh": "月面独行",
    "desc_zh": "远景到特写 · 太空探索的孤独感",
    "prompt_zh": "月球背面的荒原，宇航员独自走向一座废弃天线。镜头从极远景缓慢推进，低角度阳光在月尘上拉出长影，步伐沉重，头盔反射星光，克制冷色，宽银幕电影构图，无字幕。",
    "translations": {
      "en-US": {"title": "Solo on the Lunar Surface", "description": "Extreme long shot to close-up · Solitude of space exploration", "prompt": "Desolate wasteland on the far side of the moon, an astronaut walks alone toward an abandoned antenna. Camera slowly pushes from extreme wide shot, low-angle sunlight casts long shadows on lunar dust, heavy footsteps, visor reflecting starlight, restrained cool tones, widescreen cinematic framing, no subtitles."},
      "zh-TW": {"title": "月面獨行", "description": "遠景到特寫 · 太空探索的孤獨感", "prompt": "月球背面的荒原，宇航員獨自走向一座廢棄天線。鏡頭從極遠景緩慢推進，低角度陽光在月塵上拉出長影，步伐沉重，頭盔反射星光，克制冷色，寬銀幕電影構圖，無字幕。"},
      "ja-JP": {"title": "月面を一人歩む", "description": "遠景からクローズアップへ · 宇宙探査の孤独", "prompt": "Desolate wasteland on the far side of the moon, an astronaut walks alone toward an abandoned antenna. Camera slowly pushes from extreme wide shot, low-angle sunlight casts long shadows on lunar dust, heavy footsteps, visor reflecting starlight, restrained cool tones, widescreen cinematic framing, no subtitles."},
      "ko-KR": {"title": "달 표면의 고독한 발걸음", "description": "원경에서 클로즈업으로 · 우주 탐사의 고독감", "prompt": "Desolate wasteland on the far side of the moon, an astronaut walks alone toward an abandoned antenna. Camera slowly pushes from extreme wide shot, low-angle sunlight casts long shadows on lunar dust, heavy footsteps, visor reflecting starlight, restrained cool tones, widescreen cinematic framing, no subtitles."},
      "es-ES": {"title": "Caminata solitaria en la superficie lunar", "description": "De plano general a primer plano · La soledad de la exploración espacial", "prompt": "Desolate wasteland on the far side of the moon, an astronaut walks alone toward an abandoned antenna. Camera slowly pushes from extreme wide shot, low-angle sunlight casts long shadows on lunar dust, heavy footsteps, visor reflecting starlight, restrained cool tones, widescreen cinematic framing, no subtitles."}
    }
  },
  "original:手作星球早餐": {
    "title_zh": "手作星球早餐",
    "desc_zh": "定格动画 · 柔软材质与小动作",
    "prompt_zh": "黏土定格动画风格，一位小小宇航员在圆形厨房煎一颗星星形状的鸡蛋，鸡蛋轻轻跳起。手作指纹质感、暖奶油色、柔和侧光，固定中景，动作简短连续，可爱但不夸张。",
    "translations": {
      "en-US": {"title": "Handmade Planet Breakfast", "description": "Stop-motion clay animation · Soft materials and subtle motion", "prompt": "Clay stop-motion style, a tiny astronaut fries a star-shaped egg in a circular spaceship kitchen, the egg gently hopping in the pan. Handmade clay fingerprint textures, warm cream tones, soft sidelight, locked medium shot, charming continuous motion."},
      "zh-TW": {"title": "手作星球早餐", "description": "定格動畫 · 柔軟材質與小動作", "prompt": "黏土定格動畫風格，一位小小宇航員在圓形廚房煎一顆星星形狀的雞蛋，雞蛋輕輕跳起。手作指紋質感、暖奶油色、柔和側光，固定中景，動作簡短連續，可愛但不誇張。"},
      "ja-JP": {"title": "惑星の手作りブレックファスト", "description": "クレイストップモーション · 柔らかな質感と細やかな動き", "prompt": "Clay stop-motion style, a tiny astronaut fries a star-shaped egg in a circular spaceship kitchen, the egg gently hopping in the pan. Handmade clay fingerprint textures, warm cream tones, soft sidelight, locked medium shot, charming continuous motion."},
      "ko-KR": {"title": "수제 행성 아침 식사", "description": "스톱 모션 점토 애니메이션 · 부드러운 질감과 작은 움직임", "prompt": "Clay stop-motion style, a tiny astronaut fries a star-shaped egg in a circular spaceship kitchen, the egg gently hopping in the pan. Handmade clay fingerprint textures, warm cream tones, soft sidelight, locked medium shot, charming continuous motion."},
      "es-ES": {"title": "Desayuno planetario artesanal", "description": "Animación stop-motion en plastilina · Texturas suaves y pequeños movimientos", "prompt": "Clay stop-motion style, a tiny astronaut fries a star-shaped egg in a circular spaceship kitchen, the egg gently hopping in the pan. Handmade clay fingerprint textures, warm cream tones, soft sidelight, locked medium shot, charming continuous motion."}
    }
  },
  "original:山水之间的一叶舟": {
    "title_zh": "山水之间的一叶舟",
    "desc_zh": "水墨留白 · 横向移镜与轻雾",
    "prompt_zh": "中国水墨动画，一叶小舟缓缓穿过层叠远山，薄雾留白，舟上人抬手触碰落下的花瓣。镜头平稳横移，墨色有自然晕染，少量朱红点缀，画面安静，动作节奏舒缓。",
    "translations": {
      "en-US": {"title": "A Solitary Boat Amidst Mountains and Water", "description": "Ink wash white space · Smooth lateral tracking and delicate mist", "prompt": "Traditional Chinese ink wash animation, a solitary wooden boat glides gently through layers of distant misty mountains, spacious composition, the boatman reaches out to touch falling blossom petals. Smooth lateral camera pan, natural ink diffusion, subtle vermilion accents, peaceful and meditative atmosphere."},
      "zh-TW": {"title": "山水之間的一葉舟", "description": "水墨留白 · 橫向移鏡與輕霧", "prompt": "中國水墨動畫，一葉小舟緩緩穿過層疊遠山，薄霧留白，舟上人抬手觸碰落下的花瓣。鏡頭平穩橫移，墨色有自然暈染，少量朱紅點綴，畫面安靜，動作節奏舒緩。"},
      "ja-JP": {"title": "山水に浮かぶ一葉の舟", "description": "水墨の余白 · 水平パンと淡い霧の叙情", "prompt": "Traditional Chinese ink wash animation, a solitary wooden boat glides gently through layers of distant misty mountains, spacious composition, the boatman reaches out to touch falling blossom petals. Smooth lateral camera pan, natural ink diffusion, subtle vermilion accents, peaceful atmosphere."},
      "ko-KR": {"title": "산수 사이의 조각배", "description": "수묵 여백의 미 · 수평 패닝과 엷은 안개", "prompt": "Traditional Chinese ink wash animation, a solitary wooden boat glides gently through layers of distant misty mountains, spacious composition, the boatman reaches out to touch falling blossom petals. Smooth lateral camera pan, natural ink diffusion, subtle vermilion accents, peaceful atmosphere."},
      "es-ES": {"title": "Un pequeño bote entre montañas y ríos", "description": "Aguada de tinta china y espacios vacíos · Desplazamiento lateral y niebla suave", "prompt": "Traditional Chinese ink wash animation, a solitary wooden boat glides gently through layers of distant misty mountains, spacious composition, the boatman reaches out to touch falling blossom petals. Smooth lateral camera pan, natural ink diffusion, subtle vermilion accents, peaceful atmosphere."}
    }
  },
  "original:雨后的玻璃花房": {
    "title_zh": "雨后的玻璃花房",
    "desc_zh": "治愈场景 · 前景水滴与逆光",
    "prompt_zh": "清晨雨后的玻璃花房，镜头透过挂着水滴的叶片缓缓推向盛开的白花，阳光从侧后方进入，浅景深，真实植物纹理，空气中薄薄水汽，宁静自然，无人物和文字。",
    "translations": {
      "en-US": {"title": "Glass Conservatory After Rain", "description": "Healing atmosphere · Foreground water droplets and backlight", "prompt": "A glass greenhouse on a fresh morning after rain, camera slowly glides through leaves bearing water droplets toward blooming white blossoms, sunlight filtering softly from behind, shallow depth of field, organic plant textures, gentle airborne vapor, tranquil, without people or text."},
      "zh-TW": {"title": "雨後的玻璃花房", "description": "治癒場景 · 前景水滴與逆光", "prompt": "清晨雨後的玻璃花房，鏡頭透過掛著水滴的葉片緩緩推向盛開的白花，陽光從側後方進入，淺景深，真實植物紋理，空氣中薄薄水汽，寧靜自然，無人物和文字。"},
      "ja-JP": {"title": "雨上がりのガラス温室", "description": "癒しの空間 · 前景の雨粒と柔らかな逆光", "prompt": "A glass greenhouse on a fresh morning after rain, camera slowly glides through leaves bearing water droplets toward blooming white blossoms, sunlight filtering softly from behind, shallow depth of field, organic plant textures, gentle airborne vapor, tranquil, without people or text."},
      "ko-KR": {"title": "비 갠 뒤의 유리 온실", "description": "힐링 무드 · 전경의 물방울과 포근한 역광", "prompt": "A glass greenhouse on a fresh morning after rain, camera slowly glides through leaves bearing water droplets toward blooming white blossoms, sunlight filtering softly from behind, shallow depth of field, organic plant textures, gentle airborne vapor, tranquil, without people or text."},
      "es-ES": {"title": "Invernadero de cristal tras la lluvia", "description": "Escenario reconfortante · Gotas de agua en primer plano y contraluz", "prompt": "A glass greenhouse on a fresh morning after rain, camera slowly glides through leaves bearing water droplets toward blooming white blossoms, sunlight filtering softly from behind, shallow depth of field, organic plant textures, gentle airborne vapor, tranquil, without people or text."}
    }
  },
  "original:都市少女角色转面": {
    "title_zh": "都市少女角色转面",
    "desc_zh": "角色概念 · 统一服装与形体比例",
    "prompt_zh": "原创二维动画都市少女角色设定，短发、宽松工装夹克和帆布包，正面、侧面与背面三视图，服装细节和身高比例一致，干净线稿配平涂阴影，暖灰背景，不添加文字，不模仿已有动漫角色。",
    "translations": {
      "en-US": {"title": "Urban Girl Character Turnaround", "description": "Character concept · Consistent outfits and model sheets", "prompt": "Original 2D animation urban girl character sheet, short hair, relaxed utility jacket and canvas tote, front, side, and back 3-view turnaround, consistent apparel details and anatomy proportions, clean lineart with cell shading, warm gray background, no text."},
      "zh-TW": {"title": "都市少女角色轉面", "description": "角色概念 · 統一服裝與形體比例", "prompt": "原創二維動畫都市少女角色設定，短髮、寬鬆工裝夾克和帆布包，正面、側面與背面三視圖，服裝細節和身高比例一致，乾淨線稿配平塗陰影，暖灰背景，不添加文字，不模仿已有動漫角色。"},
      "ja-JP": {"title": "都会の少女キャラクター設定三面図", "description": "キャラクターコンセプト · 統一された服装とプロポーション", "prompt": "Original 2D animation urban girl character sheet, short hair, relaxed utility jacket and canvas tote, front, side, and back 3-view turnaround, consistent apparel details and anatomy proportions, clean lineart with cell shading, warm gray background, no text."},
      "ko-KR": {"title": "도시 소녀 캐릭터 3면도", "description": "캐릭터 콘셉트 · 일관된 복장과 신체 비율", "prompt": "Original 2D animation urban girl character sheet, short hair, relaxed utility jacket and canvas tote, front, side, and back 3-view turnaround, consistent apparel details and anatomy proportions, clean lineart with cell shading, warm gray background, no text."},
      "es-ES": {"title": "Giro de personaje de chica urbana", "description": "Concepto de personaje · Vestuario y proporciones anatómicas consistentes", "prompt": "Original 2D animation urban girl character sheet, short hair, relaxed utility jacket and canvas tote, front, side, and back 3-view turnaround, consistent apparel details and anatomy proportions, clean lineart with cell shading, warm gray background, no text."}
    }
  },
  "original:梦境里的倒置房间": {
    "title_zh": "梦境里的倒置房间",
    "desc_zh": "超现实概念 · 重力反转与柔光",
    "prompt_zh": "超现实电影场景概念图，一间漂浮在云海中的倒置卧室，床和书桌悬在天花板上，一扇门通向浅粉色天空。低饱和奶油与雾蓝色，柔和漫反射，精确透视，细腻材质，无人物，无文字。",
    "translations": {
      "en-US": {"title": "Inverted Room in a Dream", "description": "Surrealistic concept · Gravity reversal and diffused glow", "prompt": "Surrealistic cinematic concept art, an inverted bedroom floating amidst a sea of clouds, bed and desk suspended from the ceiling, a doorway opening into a soft pink sky. Muted cream and mist blue palette, soft diffuse bounce lighting, precise perspective, rich textures, no figures, no text."},
      "zh-TW": {"title": "夢境裡的倒置房間", "description": "超現實概念 · 重力反轉與柔光", "prompt": "超現實電影場景概念圖，一間漂浮在雲海中的倒置臥室，床和書桌懸在天花板上，一扇門通向淺粉色天空。低飽和奶油與霧藍色，柔和漫反射，精確透視，細膩材質，無人物，無文字。"},
      "ja-JP": {"title": "夢の中の逆さまの部屋", "description": "シュルレアリスム · 重力の反転と淡い光", "prompt": "Surrealistic cinematic concept art, an inverted bedroom floating amidst a sea of clouds, bed and desk suspended from the ceiling, a doorway opening into a soft pink sky. Muted cream and mist blue palette, soft diffuse bounce lighting, precise perspective, rich textures, no figures, no text."},
      "ko-KR": {"title": "꿈속의 뒤집힌 방", "description": "초현실주의 콘셉트 · 중력 반전과 부드러운 산란광", "prompt": "Surrealistic cinematic concept art, an inverted bedroom floating amidst a sea of clouds, bed and desk suspended from the ceiling, a doorway opening into a soft pink sky. Muted cream and mist blue palette, soft diffuse bounce lighting, precise perspective, rich textures, no figures, no text."},
      "es-ES": {"title": "Habitación invertida en un sueño", "description": "Concepto surrealista · Gravedad invertida y luz difusa", "prompt": "Surrealistic cinematic concept art, an inverted bedroom floating amidst a sea of clouds, bed and desk suspended from the ceiling, a doorway opening into a soft pink sky. Muted cream and mist blue palette, soft diffuse bounce lighting, precise perspective, rich textures, no figures, no text."}
    }
  },
  "original:海边旅店的黄昏": {
    "title_zh": "海边旅店的黄昏",
    "desc_zh": "实拍场景 · 用道具留下人物痕迹",
    "prompt_zh": "沿海小城旧旅店房间的电影置景概念图，窗外是黄昏海面，风吹动米白窗帘，桌上有两杯没有喝完的茶和一本翻开的书。暖橙与浅蓝对比，自然胶片颗粒，眼平中广角，没有人物和可读文字。",
    "translations": {
      "en-US": {"title": "Dusk at the Seaside Inn", "description": "Live-action setting · Imbuing presence through scenic props", "prompt": "Cinematic set design concept of an old coastal hotel room, outside the window is the sunset sea, wind stirring cream curtains, two half-finished teacups and an open book resting on the wooden table. Warm amber and soft cyan contrast, natural film grain, eye-level medium wide shot, no human presence, no readable text."},
      "zh-TW": {"title": "海邊旅店的黃昏", "description": "實拍場景 · 用道具留下人物痕跡", "prompt": "沿海小城舊旅店房間的電影置景概念圖，窗外是黃昏海面，風吹動米白窗簾，桌上有兩杯沒有喝完的茶和一本翻開的書。暖橙與淺藍對比，自然膠片顆粒，眼平中廣角，沒有人物和可讀文字。"},
      "ja-JP": {"title": "海辺の宿の黄昏", "description": "実写映画の美術設計 · 小道具で人の余韻を紡ぐ", "prompt": "Cinematic set design concept of an old coastal hotel room, outside the window is the sunset sea, wind stirring cream curtains, two half-finished teacups and an open book resting on the wooden table. Warm amber and soft cyan contrast, natural film grain, eye-level medium wide shot, no human presence, no readable text."},
      "ko-KR": {"title": "바닷가 여관의 황혼", "description": "실사 영화 세트 디자인 · 소품으로 남긴 인물의 흔적", "prompt": "Cinematic set design concept of an old coastal hotel room, outside the window is the sunset sea, wind stirring cream curtains, two half-finished teacups and an open book resting on the wooden table. Warm amber and soft cyan contrast, natural film grain, eye-level medium wide shot, no human presence, no readable text."},
      "es-ES": {"title": "Atardecer en la posada junto al mar", "description": "Escenografía de rodaje · Huellas humanas a través de objetos", "prompt": "Cinematic set design concept of an old coastal hotel room, outside the window is the sunset sea, wind stirring cream curtains, two half-finished teacups and an open book resting on the wooden table. Warm amber and soft cyan contrast, natural film grain, eye-level medium wide shot, no human presence, no readable text."}
    }
  },
  "original:鲜亮漫画封面": {
    "title_zh": "鲜亮漫画封面",
    "desc_zh": "平面构成 · 大色块与戏剧性透视",
    "prompt_zh": "原创漫画封面插画，一位骑单车的城市信使跃过雨后积水，戏剧性低角度透视，青蓝、珊瑚红与暖黄色大色块，半调网点，清晰黑色轮廓，背景简洁，为顶部标题留白但不生成文字。",
    "translations": {
      "en-US": {"title": "Vibrant Comic Book Cover", "description": "Graphic design · Bold color blocking and dramatic perspective", "prompt": "Original comic cover illustration, an urban bike courier leaping over rainwater puddles, dramatic low-angle perspective, bold blocks of teal, coral red, and warm yellow, halftone screentones, crisp black ink outlines, clean background with negative space reserved for title, no text generated."},
      "zh-TW": {"title": "鮮亮漫畫封面", "description": "平面構成 · 大色塊與戲劇性透視", "prompt": "原創漫畫封面插畫，一位騎單車的城市信使躍過雨後積水，戲劇性低角度透視，青藍、珊瑚紅與暖黃色大色塊，半調網點，清晰黑色輪廓，背景簡潔，為頂部標題留白但不生成文字。"},
      "ja-JP": {"title": "鮮やかなコミックカバー", "description": "グラフィック構成 · 大胆なカラーブロッキングとパースペクティブ", "prompt": "Original comic cover illustration, an urban bike courier leaping over rainwater puddles, dramatic low-angle perspective, bold blocks of teal, coral red, and warm yellow, halftone screentones, crisp black ink outlines, clean background with negative space reserved for title, no text generated."},
      "ko-KR": {"title": "선명한 만화 표지", "description": "그래픽 구성 · 대담한 컬러 블록과 드라마틱한 투시", "prompt": "Original comic cover illustration, an urban bike courier leaping over rainwater puddles, dramatic low-angle perspective, bold blocks of teal, coral red, and warm yellow, halftone screentones, crisp black ink outlines, clean background with negative space reserved for title, no text generated."},
      "es-ES": {"title": "Portada de cómic vibrante", "description": "Composición gráfica · Bloques de color y perspectiva dramática", "prompt": "Original comic cover illustration, an urban bike courier leaping over rainwater puddles, dramatic low-angle perspective, bold blocks of teal, coral red, and warm yellow, halftone screentones, crisp black ink outlines, clean background with negative space reserved for title, no text generated."}
    }
  },
  "original:烘焙店的秘密帮手": {
    "title_zh": "烘焙店的秘密帮手",
    "desc_zh": "三维角色 · 柔和材质与亲切表情",
    "prompt_zh": "原创三维动画角色概念图，一只穿着面粉围裙的小浣熊站在烘焙台前，鼻尖沾着面粉，手里举着刚烤好的面包。柔软毛发、温暖侧光、自然可爱的比例，橘棕色和奶油白配色，背景轻微虚化。",
    "translations": {
      "en-US": {"title": "Secret Helper in the Bakery", "description": "3D character · Plush fur textures and heartwarming expression", "prompt": "Original 3D animated character concept, a tiny raccoon wearing a flour-dusted apron standing before a baking counter, flour dusted on its nose, proudly holding up freshly baked bread. Soft grooming fur, warm sidelight, gentle endearing proportions, orange-brown and cream palette, softly blurred background."},
      "zh-TW": {"title": "烘焙店的秘密幫手", "description": "三維角色 · 柔和材質與親切表情", "prompt": "原創三維動畫角色概念圖，一隻穿著麵粉圍裙的小浣熊站在烘焙台前，鼻尖沾著麵粉，手裡舉著剛烤好的麵包。柔軟毛髮、溫暖側光、自然可愛的比例，橘棕色和奶油白配色，背景輕微虛化。"},
      "ja-JP": {"title": "ベーカリーの秘密の助手", "description": "3Dキャラクター · 柔らかな毛並みと温かな表情", "prompt": "Original 3D animated character concept, a tiny raccoon wearing a flour-dusted apron standing before a baking counter, flour dusted on its nose, proudly holding up freshly baked bread. Soft grooming fur, warm sidelight, gentle endearing proportions, orange-brown and cream palette, softly blurred background."},
      "ko-KR": {"title": "베이커리의 비밀 조수", "description": "3D 캐릭터 · 보드라운 털 질감과 다정한 표정", "prompt": "Original 3D animated character concept, a tiny raccoon wearing a flour-dusted apron standing before a baking counter, flour dusted on its nose, proudly holding up freshly baked bread. Soft grooming fur, warm sidelight, gentle endearing proportions, orange-brown and cream palette, softly blurred background."},
      "es-ES": {"title": "El ayudante secreto de la pastelería", "description": "Personaje 3D · Pelo suave y expresión entrañable", "prompt": "Original 3D animated character concept, a tiny raccoon wearing a flour-dusted apron standing before a baking counter, flour dusted on its nose, proudly holding up freshly baked bread. Soft grooming fur, warm sidelight, gentle endearing proportions, orange-brown and cream palette, softly blurred background."}
    }
  }
}

LOCALES = ["en-US", "zh-TW", "ja-JP", "ko-KR", "es-ES"]

# Accurate, safe Simplified to Traditional Chinese mapping (excluding financial numerals and archaic variants)
S2T_SAFE = {
    '爱': '愛', '碍': '礙', '袄': '襖', '奥': '奧', '坝': '壩', '办': '辦', '帮': '幫',
    '宝': '寶', '报': '報', '贝': '貝', '备': '備', '笔': '筆', '毕': '畢', '闭': '閉', '边': '邊',
    '变': '變', '标': '標', '别': '別', '补': '補', '布': '佈', '惨': '慘', '仓': '倉',
    '产': '產', '长': '長', '尝': '嘗', '偿': '償', '彻': '徹', '尘': '塵', '衬': '襯', '称': '稱',
    '创': '創', '辞': '辭', '从': '從', '聪': '聰', '当': '當', '党': '黨', '导': '導', '灯': '燈',
    '点': '點', '电': '電', '淀': '澱', '顶': '頂', '动': '動', '断': '斷', '对': '對', '队': '隊',
    '吨': '噸', '夺': '奪', '堕': '墮', '儿': '兒', '尔': '爾', '发': '發', '范': '範', '飞': '飛',
    '坟': '墳', '奋': '奮', '风': '風', '丰': '豐', '讽': '諷', '凤': '鳳', '妇': '婦', '复': '復',
    '赶': '趕', '个': '個', '巩': '鞏', '沟': '溝', '构': '構', '购': '購', '顾': '顧', '刮': '颳',
    '关': '關', '观': '觀', '馆': '館', '广': '廣', '归': '歸', '国': '國', '过': '過', '华': '華',
    '画': '畫', '怀': '懷', '坏': '壞', '欢': '歡', '环': '環', '还': '還', '会': '會', '获': '獲',
    '迹': '跡', '几': '幾', '机': '機', '击': '擊', '际': '際', '剂': '劑', '济': '濟', '价': '價',
    '驾': '駕', '艰': '艱', '监': '監', '见': '見', '坚': '堅', '间': '間', '拣': '揀', '检': '檢',
    '简': '簡', '渐': '漸', '节': '節', '杰': '傑', '尽': '盡', '紧': '緊', '进': '進', '经': '經',
    '惊': '驚', '觉': '覺', '决': '決', '卷': '捲', '开': '開', '壳': '殼', '垦': '墾', '夸': '誇',
    '块': '塊', '亏': '虧', '困': '睏', '兰': '蘭', '烂': '爛', '累': '纍', '垒': '壘', '类': '類',
    '礼': '禮', '隶': '隸', '帘': '簾', '联': '聯', '练': '練', '粮': '糧', '两': '兩', '辆': '輛',
    '辽': '遼', '疗': '療', '临': '臨', '邻': '鄰', '灵': '靈', '龄': '齡', '历': '歷', '恋': '戀',
    '凉': '涼', '刘': '劉', '龙': '龍', '楼': '樓', '芦': '蘆', '卢': '盧', '陆': '陸', '录': '錄',
    '滤': '濾', '乱': '亂', '论': '論', '罗': '羅', '马': '馬', '买': '買', '卖': '賣', '迈': '邁',
    '麦': '麥', '猫': '貓', '门': '門', '们': '們', '梦': '夢', '灭': '滅', '悯': '憫', '难': '難',
    '恼': '惱', '脑': '腦', '拟': '擬', '酿': '釀', '鸟': '鳥', '聂': '聶', '宁': '寧', '农': '農',
    '齐': '齊', '气': '氣', '迁': '遷', '牵': '牽', '铅': '鉛', '钱': '錢', '强': '強', '墙': '牆',
    '抢': '搶', '桥': '橋', '乔': '喬', '亲': '親', '穷': '窮', '区': '區', '驱': '驅', '让': '讓',
    '热': '熱', '认': '認', '荣': '榮', '绒': '絨', '软': '軟', '锐': '銳', '润': '潤', '洒': '灑',
    '萨': '薩', '伞': '傘', '丧': '喪', '扫': '掃', '涩': '澀', '杀': '殺', '纱': '紗', '筛': '篩',
    '晒': '曬', '闪': '閃', '陕': '陝', '伤': '傷', '摄': '攝', '设': '設', '审': '審', '声': '聲',
    '胜': '勝', '湿': '濕', '诗': '詩', '实': '實', '时': '時', '识': '識', '视': '視', '试': '試',
    '释': '釋', '寿': '壽', '兽': '獸', '枢': '樞', '输': '輸', '书': '書', '数': '數', '帅': '帥',
    '双': '雙', '谁': '誰', '税': '稅', '顺': '順', '说': '說', '烁': '爍', '丝': '絲', '饲': '飼',
    '耸': '聳', '松': '鬆', '颂': '頌', '苏': '蘇', '诉': '訴', '肃': '肅', '虽': '雖', '随': '隨',
    '岁': '歲', '孙': '孫', '损': '損', '笋': '筍', '态': '態', '钛': '鈦', '贪': '貪', '摊': '攤',
    '滩': '灘', '坛': '壇', '叹': '歎', '汤': '湯', '涛': '濤', '讨': '討', '腾': '騰', '誊': '謄',
    '体': '體', '条': '條', '铁': '鐵', '厅': '廳', '听': '聽', '铜': '銅', '头': '頭', '图': '圖',
    '团': '團', '脱': '脫', '驼': '駝', '湾': '灣', '顽': '頑', '挽': '輓', '万': '萬', '网': '網',
    '为': '為', '围': '圍', '违': '違', '维': '維', '伟': '偉', '伪': '偽', '纬': '緯', '卫': '衛',
    '务': '務', '误': '誤', '习': '習', '戏': '戲', '细': '細', '吓': '嚇', '纤': '纖', '鲜': '鮮',
    '闲': '閒', '显': '顯', '险': '險', '现': '現', '线': '線', '乡': '鄉', '详': '詳', '响': '響',
    '项': '項', '销': '銷', '协': '協', '携': '攜', '写': '寫', '谢': '謝', '虚': '虛', '叙': '敘',
    '绪': '緒', '续': '續', '轩': '軒', '选': '選', '学': '學', '寻': '尋', '训': '訓', '讯': '訊',
    '逊': '遜', '压': '壓', '鸦': '鴉', '鸭': '鴨', '亚': '亞', '严': '嚴', '盐': '鹽', '颜': '顏',
    '验': '驗', '厌': '厭', '阳': '陽', '扬': '揚', '杨': '楊', '养': '養', '样': '樣', '药': '藥',
    '钥': '鑰', '爷': '爺', '业': '業', '叶': '葉', '页': '頁', '医': '醫', '仪': '儀', '遗': '遺',
    '艺': '藝', '亿': '億', '忆': '憶', '义': '義', '议': '議', '异': '異', '译': '譯', '阴': '陰',
    '银': '銀', '饮': '飲', '隐': '隱', '应': '應', '营': '營', '萤': '螢', '赢': '贏', '拥': '擁',
    '优': '優', '忧': '憂', '邮': '郵', '游': '遊', '余': '餘', '鱼': '魚', '娱': '娛', '渔': '漁',
    '与': '與', '语': '語', '预': '預', '誉': '譽', '远': '遠', '愿': '願', '约': '約', '乐': '樂',
    '跃': '躍', '云': '雲', '匀': '勻', '运': '運', '晕': '暈', '韵': '韻', '杂': '雜', '灾': '災',
    '载': '載', '赞': '讚', '脏': '髒', '则': '則', '责': '責', '择': '擇', '贼': '賊', '增': '增',
    '赠': '贈', '扎': '紮', '闸': '閘', '债': '債', '战': '戰', '张': '張', '涨': '漲', '针': '針',
    '侦': '偵', '诊': '診', '阵': '陣', '振': '振', '震': '震', '镇': '鎮', '争': '爭', '征': '徵',
    '睁': '睜', '挣': '掙', '证': '證', '只': '隻', '织': '織', '职': '職', '执': '執', '纸': '紙',
    '制': '製', '质': '質', '滞': '滯', '终': '終', '钟': '鐘', '种': '種', '昼': '晝', '骤': '驟',
    '诸': '諸', '猪': '豬', '筑': '築', '专': '專', '转': '轉', '赚': '賺', '庄': '莊', '装': '裝',
    '壮': '壯', '状': '狀', '准': '準', '资': '資', '总': '總', '纵': '縱', '组': '組', '摄': '攝',
    '镜': '鏡', '头': '頭', '构': '構', '图': '圖', '调': '調', '色': '色', '频': '頻', '阔': '闊',
    '银': '銀', '幕': '幕', '缓': '緩', '慢': '慢', '推': '推', '进': '進', '近': '近', '写': '寫'
}

def to_traditional_chinese(text):
    if not text:
        return ""
    return "".join(S2T_SAFE.get(c, c) for c in text)

def main():
    print("Reading catalog sources...")
    all_catalog_entries = []
    
    # 22 curated entries
    for cid, cval in CURATED_DATA.items():
        all_catalog_entries.append({
            "id": cid,
            "title": cval["title_zh"],
            "description": cval["desc_zh"],
            "prompt": cval["prompt_zh"]
        })

    for sf in ["seedance.json", "haohaoxue.json", "youmind.json"]:
        p = os.path.join(PUBLIC_DIR, sf)
        if os.path.exists(p):
            with open(p, "r", encoding="utf8") as f:
                d = json.load(f)
                all_catalog_entries.extend(d.get("entries") or d)

    print(f"Total catalog entries: {len(all_catalog_entries)}")

    # Load original English prompts from git history (before 88de4ce4)
    old_en_prompts = {}
    try:
        for name in ["seedance", "haohaoxue", "youmind"]:
            cmd = ["git", "show", f"88de4ce4~1:web/public/inspirations/{name}.json"]
            raw = subprocess.check_output(cmd).decode("utf8")
            d = json.loads(raw)
            entries = d.get("entries") or d
            for e in entries:
                if e.get("id") and e.get("prompt"):
                    old_en_prompts[e["id"]] = e["prompt"]
        print(f"Loaded {len(old_en_prompts)} original English prompts from git history.")
    except Exception as e:
        print(f"Warning: could not load git old prompts: {e}")

    # Load existing translation files
    packs = {}
    for loc in LOCALES:
        loc_path = os.path.join(OUT_DIR, f"{loc}.json")
        if os.path.exists(loc_path):
            with open(loc_path, "r", encoding="utf8") as f:
                packs[loc] = json.load(f)
        else:
            packs[loc] = {}

    for loc in LOCALES:
        pack = packs[loc]
        print(f"Processing locale: {loc}...")

        # 1. Inject curated works
        for cid, cdata in CURATED_DATA.items():
            trans = cdata["translations"].get(loc, {})
            title = trans.get("title") or cdata["title_zh"]
            desc = trans.get("description") or cdata["desc_zh"]
            prompt = trans.get("prompt") or cdata["prompt_zh"]
            entry_data = {"title": title, "description": desc, "prompt": prompt}
            # Key by catalogId and also by plain title
            pack[cid] = entry_data
            pack[cdata["title_zh"]] = entry_data

        # 2. Process all entries
        for e in all_catalog_entries:
            eid = e.get("id") or e.get("title")
            title_zh = e.get("title", "").strip()
            desc_zh = e.get("description", "").strip()
            prompt_zh = e.get("prompt", "").strip()

            item_obj = pack.get(eid, {})
            title = item_obj.get("title") or title_zh
            desc = item_obj.get("description") or desc_zh

            # Prompt resolution per locale
            if loc == "en-US":
                # Prefer original English prompt from git history
                prompt = old_en_prompts.get(eid) or item_obj.get("prompt") or prompt_zh
            elif loc == "zh-TW":
                # Traditional Chinese
                title = to_traditional_chinese(title)
                desc = to_traditional_chinese(desc)
                prompt = to_traditional_chinese(item_obj.get("prompt") or prompt_zh)
            else:
                # ja-JP, ko-KR, es-ES:
                # Use model-ready English prompt from old_en_prompts or en-US pack if available,
                # as AI image/video models expect English prompts.
                en_prompt = old_en_prompts.get(eid) or packs["en-US"].get(eid, {}).get("prompt")
                prompt = en_prompt or item_obj.get("prompt") or prompt_zh

            pack[eid] = {
                "title": title,
                "description": desc,
                "prompt": prompt
            }
            if title_zh and title_zh not in pack:
                pack[title_zh] = pack[eid]

        out_path = os.path.join(OUT_DIR, f"{loc}.json")
        with open(out_path, "w", encoding="utf8") as f:
            json.dump(pack, f, ensure_ascii=False, indent=1)
        print(f"[{loc}] wrote {len(pack)} entries ({os.path.getsize(out_path)} bytes)")

    print("\nAll translation packs updated successfully!")

if __name__ == "__main__":
    main()
