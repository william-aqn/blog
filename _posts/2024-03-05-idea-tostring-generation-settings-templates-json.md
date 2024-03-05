---
layout: post
title: "Быстро сериализуем объект в json строку в IDEA"
description: "Alt+Ins->toString()"
tags: java idea
---
# Быстро сериализуем объект в json строку в IDEA
Добавляем шаблон для быстрой генерации json из idea->toString без null значений
Заходим в раздел **toString() Generation Settings**

`Alt+Ins->toString()->Settings->Templates`
![toString() Generation Settings](/assets/blog/idea-tostring/jsonStringJoiner.png)
```java
public java.lang.String toString() {
StringJoiner s = new java.util.StringJoiner(",", "{", "}");
#foreach ($member in $members)##
    #if(!$member.modifierStatic)##
if ($member.name!=null) {##
s.add("\"$member.name\":\""+##
        #if ($member.primitiveArray || $member.objectArray)##
java.util.Arrays.toString($member.name)##
        #elseif ($member.string)##
            $member.accessor ##
        #else
            $member.accessor ##
        #end##
+"\"");
}
    #end
#end
return s.toString();
}
```