function getClientInfo() {
  return {
    "name": "歌词-粘贴所选音符歌词(保留-+，按字符隔开)",
    "category": "不死の祥云",
    "author": "不死の祥云",
    "versionNumber": 1,
    "minEditorVersion": 65540
  };
}

function main() {
  const selection = SV.getMainEditor().getSelection();
  const selectedNotes = selection.getSelectedNotes();
  const Lyrics = SV.getHostClipboard();

  // 日语小假名列表
  const smallKana = /[ぁぃぅぇぉゃゅょゎっァィゥェォヵヶャュョヮッ]/;
  
  // 分割歌词：英文字母按空白符分隔，其余按字符分隔
  var lyricArray = [];
  var currentWord = "";
  var isInEnglish = false;
  
  for (var k = 0; k < Lyrics.length; k++) {
    const char = Lyrics[k];

    // 检查是否是英文字母
    if (/[a-zA-Z']/.test(char)) {
      currentWord += char;
      isInEnglish = true;
    } else if (/\s/.test(char)) {
      // 遇到空白符
      if (isInEnglish && currentWord) {
        // 如果之前在英文单词中，结束当前单词
        lyricArray.push(currentWord);
        currentWord = "";
        isInEnglish = false;
      }
      // 忽略空白符本身（非英文情况下的空白符）
    } else {
      // 其他字符（中文、数字、符号等）
      if (isInEnglish && currentWord) {
        // 如果之前在英文单词中，先保存英文单词
        lyricArray.push(currentWord);
        currentWord = "";
        isInEnglish = false;
      }
      
      // 检查是否是日语小假名
      if (smallKana.test(char) && lyricArray.length > 0) {
        // 如果是小假名且数组不为空，附加到前一个元素
        lyricArray[lyricArray.length - 1] += char;
      } else {
        // 非英文字符按单个字符分隔
        lyricArray.push(char);
      }
    }
  }
  
  // 处理最后可能剩余的英文单词
  if (currentWord) {
    lyricArray.push(currentWord);
  }
  
  var j = 0;

  if (lyricArray.length > 0) {
    for (var i = 0; i < selectedNotes.length; i++) {
      const currentLyric = selectedNotes[i].getLyrics();

      // 如果当前音符的歌词是 "-" 或 "+"，跳过不修改
      if (currentLyric === "-" || currentLyric === "+") {
        continue;
      }

      // 如果歌词用完了，填入默认la
      if (j >= lyricArray.length) {
        selectedNotes[i].setLyrics("la");
      } else {
        // 将剪贴板中的歌词赋值给当前音符
        selectedNotes[i].setLyrics(lyricArray[j]);
        j++;
      }
    }
  }

  SV.finish();
}
