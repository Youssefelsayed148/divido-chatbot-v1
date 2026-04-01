// ── Divido Chatbot — Flutter Widget ──────────────────────────────────────────
// Version: 3.0 (Phase V1 Final — Streaming + Cache + Arabic Form + Contact Support)
//
// Drop this file into: lib/widgets/divido_chat_widget.dart
//
// Dependencies (add to pubspec.yaml):
//   http: ^1.2.0
//   shared_preferences: ^2.2.3
//   flutter_markdown: ^0.7.3
//
// Usage:
//   import 'package:your_app/widgets/divido_chat_widget.dart';
//   DividoChatWidget(language: "ar")  // or "en"

import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_markdown/flutter_markdown.dart';

// ── Configuration ─────────────────────────────────────────────────────────────
// Android emulator reaches host machine via 10.0.2.2
// iOS simulator reaches host machine via 127.0.0.1
// Physical device: use your computer's local IP e.g. http://192.168.1.x:8000
// Production: http://your-domain.com/api
// Android emulator: http://10.0.2.2:8000
// iOS simulator:    http://127.0.0.1:8000
// Real device:      http://YOUR_PC_LAN_IP:8000
// Production:       https://your-domain.com/api
const String _kApiBase = "http://10.0.2.2:8080/api";
// const String _kApiBase = "https://your-production-domain.com/api";

const Color _kOrange     = Color(0xFFFF6B2B);
const Color _kOrangeDark = Color(0xFFE84E0F);
const Color _kDark       = Color(0xFF1A1A1A);
const Color _kDark2      = Color(0xFF2D2D2D);
const Color _kGrey       = Color(0xFFF5F5F5);
const Color _kBorder     = Color(0xFFEEEEEE);
const Color _kOrangeLight= Color(0xFFFFF0E8);

// ── Translations ──────────────────────────────────────────────────────────────
const Map<String, Map<String, String>> _T = {
  "en": {
    "title":            "Divido Assistant",
    "subtitle":         "Online · Real Estate Investment Guide",
    "placeholder":      "Ask anything about Divido...",
    "typing":           "Divido is thinking...",
    "welcome":          "Hello! I'm **Divido's AI Assistant**.\n\nI can help you understand the platform, explore investment opportunities, and answer your questions about fractional real estate.",
    "error":            "Something went wrong. Please try again.",
    "contact_title":    "Reach us directly",
    "contact_sub":      "Our team is available to help you personally.",
    "email_label":      "Email",
    "phone_label":      "Phone",
    "form_title":       "Get in Touch",
    "form_sub":         "Our team will contact you shortly",
    "name_label":       "Full Name",
    "name_hint":        "Enter your full name",
    "email_label2":     "Email Address",
    "email_hint":       "Enter your email",
    "phone_label2":     "Phone Number",
    "phone_hint":       "Optional",
    "submit":           "Send Message",
    "submitting":       "Sending...",
    "form_success":     "Thank you! We'll be in touch soon.",
    "form_error":       "Please enter your name and a valid email.",
    "contact_support":  "Contact Support",
    "start_conv":       "Start of conversation",
    "footer":           "Powered by Divido AI",
  },
  "ar": {
    "title":            "مساعد ديفيدو",
    "subtitle":         "متاح · دليل الاستثمار العقاري",
    "placeholder":      "اسأل أي شيء عن ديفيدو...",
    "typing":           "ديفيدو يفكر...",
    "welcome":          "مرحباً! أنا **مساعد ديفيدو الذكي**.\n\nيمكنني مساعدتك في فهم المنصة، واستكشاف فرص الاستثمار، والإجابة على أسئلتك حول العقارات التجزيئية.",
    "error":            "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
    "contact_title":    "تواصل معنا مباشرة",
    "contact_sub":      "فريقنا متاح لمساعدتك شخصياً.",
    "email_label":      "البريد الإلكتروني",
    "phone_label":      "الهاتف",
    "form_title":       "تواصل معنا",
    "form_sub":         "سيتواصل معك فريقنا قريباً",
    "name_label":       "الاسم الكامل",
    "name_hint":        "أدخل اسمك الكامل",
    "email_label2":     "البريد الإلكتروني",
    "email_hint":       "أدخل بريدك الإلكتروني",
    "phone_label2":     "رقم الهاتف",
    "phone_hint":       "اختياري",
    "submit":           "إرسال الرسالة",
    "submitting":       "جارٍ الإرسال...",
    "form_success":     "شكراً لك! سيتواصل معك فريق ديفيدو قريباً.",
    "form_error":       "يرجى إدخال اسمك وبريد إلكتروني صحيح.",
    "contact_support":  "تواصل مع الدعم",
    "start_conv":       "بداية المحادثة",
    "footer":           "مدعوم بواسطة ديفيدو AI",
  }
};

// Support button labels in both languages
const List<String> _kSupportLabels = [
  "Contact Support", "تواصل مع الدعم", "Need Help", "تحتاج مساعدة؟"
];

// ── Data Models ───────────────────────────────────────────────────────────────
enum _MsgType { text, leadForm }

class _Message {
  final String    role;
  final _MsgType  type;
  String          text;
  List<String>             buttons;    // ← final removed
  final Map<String, dynamic>  contactInfo;
  bool            streaming;           // ← final removed
  final String    formLang;
  final DateTime  time;

  _Message({
    required this.role,
    this.type       = _MsgType.text,
    this.text       = "",
    List<String>?   buttons,
    Map<String, dynamic>? contactInfo,
    this.streaming  = false,
    this.formLang   = "en",
    DateTime?       time,
  }) : buttons     = buttons ?? [],
       contactInfo = contactInfo ?? {},
       time        = time ?? DateTime.now();
}

// ── Main Widget ───────────────────────────────────────────────────────────────
class DividoChatWidget extends StatefulWidget {
  final String language;
  const DividoChatWidget({super.key, this.language = "en"});

  @override
  State<DividoChatWidget> createState() => _DividoChatWidgetState();
}

class _DividoChatWidgetState extends State<DividoChatWidget>
    with SingleTickerProviderStateMixin {

  bool   _isOpen    = false;
  bool   _isLoading = false;
  String _sessionId = "";
  String _lang      = "en";

  final List<_Message>       _messages = [];
  final TextEditingController _ctrl     = TextEditingController();
  final ScrollController      _scroll   = ScrollController();
  late  AnimationController   _animCtrl;
  late  Animation<Offset>     _slideAnim;

  // ── Init ───────────────────────────────────────────────────────────────────
  @override
  void initState() {
    super.initState();
    _lang = widget.language;
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    );
    _slideAnim = Tween<Offset>(begin: const Offset(0, 1), end: Offset.zero)
        .animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutCubic));
    _loadSession();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _ctrl.dispose();
    _scroll.dispose();
    super.dispose();
  }

  // ── Session persisted across app restarts ──────────────────────────────────
  Future<void> _loadSession() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _sessionId = prefs.getString("divido_session_id") ??
          DateTime.now().millisecondsSinceEpoch.toString();
    });
    await prefs.setString("divido_session_id", _sessionId);

    // Fetch welcome buttons from API
    try {
      final res = await http.get(
        Uri.parse("$_kApiBase/chat/buttons/app?language=$_lang"),
      ).timeout(const Duration(seconds: 5));
      List<String> btns = _lang == "ar"
          ? ["كيف يعمل ديفيدو", "استكشف الفرص", "تحتاج مساعدة؟", "الثقة والقانون"]
          : ["How Divido Works", "Explore Opportunities", "Need Help", "Trust & Legal"];
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        btns = List<String>.from(data["buttons"] ?? btns);
      }
      _messages.add(_Message(
        role:    "bot",
        text:    _T[_lang]!["welcome"]!,
        buttons: btns,
      ));
    } catch (_) {
      _messages.add(_Message(
        role:    "bot",
        text:    _T[_lang]!["welcome"]!,
        buttons: _lang == "ar"
            ? ["كيف يعمل ديفيدو", "استكشف الفرص", "تحتاج مساعدة؟", "الثقة والقانون"]
            : ["How Divido Works", "Explore Opportunities", "Need Help", "Trust & Legal"],
      ));
    }
    if (mounted) setState(() {});
  }

  // ── Toggle ─────────────────────────────────────────────────────────────────
  void _toggleChat() {
    setState(() => _isOpen = !_isOpen);
    if (_isOpen) {
      _animCtrl.forward();
      Future.delayed(const Duration(milliseconds: 100), _scrollToBottom);
    } else {
      _animCtrl.reverse();
    }
  }

  // ── Arabic detection ───────────────────────────────────────────────────────
  bool _isArabicText(String text) {
    final arabicChars = text.runes
        .where((r) => r >= 0x0600 && r <= 0x06FF)
        .length;
    return arabicChars / text.length.clamp(1, 9999) > 0.3;
  }

  // ── Send via streaming SSE ─────────────────────────────────────────────────
  Future<void> _sendMessage(String text, {String? clickedButton}) async {
    if (text.trim().isEmpty || _isLoading) return;

    // ── Contact Support → show form directly, no API call ──────────────────
    if (clickedButton != null && _kSupportLabels.contains(clickedButton)) {
      final formLang = _isArabicText(clickedButton) ? "ar" : "en";
      setState(() {
        _messages.add(_Message(role: "user", text: text.trim()));
        _messages.add(_Message(
          role:     "bot",
          type:     _MsgType.leadForm,
          formLang: formLang,
        ));
      });
      _scrollToBottom();
      return;
    }

    final msgLang = (_lang == "en" && _isArabicText(text)) ? "ar" : _lang;

    // Add user message + empty streaming bot message
    final botMsg = _Message(role: "bot", text: "", streaming: true);
    setState(() {
      _messages.add(_Message(role: "user", text: text.trim()));
      _messages.add(botMsg);
      _isLoading = true;
    });
    _ctrl.clear();
    _scrollToBottom();

    try {
      final request = http.Request(
        "POST",
        Uri.parse("$_kApiBase/chat/stream"),
      );
      request.headers["Content-Type"] = "application/json";
      request.headers["Accept"]       = "text/event-stream";
      request.body = jsonEncode({
        "message":        text.trim(),
        "session_id":     _sessionId,
        "clicked_button": clickedButton,
        "language":       msgLang,
      });

      final client   = http.Client();
      final response = await client.send(request)
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final stream    = response.stream.transform(utf8.decoder);
        String buffer   = "";

        await for (final chunk in stream) {
          buffer += chunk;
          final lines = buffer.split("\n");
          buffer = lines.removeLast(); // keep incomplete line

          for (final line in lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              final data = jsonDecode(line.substring(6));

              if (data["type"] == "chunk") {
                setState(() {
                  botMsg.text += (data["text"] as String? ?? "");
                });
                _scrollToBottom();
              } else if (data["type"] == "done") {
                // Update session id
                if (data["session_id"] != null) {
                  _sessionId = data["session_id"];
                  final prefs = await SharedPreferences.getInstance();
                  await prefs.setString("divido_session_id", _sessionId);
                }

                // Ensure Contact Support button is always present
                final btns = List<String>.from(data["suggested_buttons"] ?? []);
                final supportBtn = msgLang == "ar" ? "تواصل مع الدعم" : "Contact Support";
                if (!btns.contains(supportBtn)) btns.add(supportBtn);

                setState(() {
                  botMsg.streaming = false;
                  botMsg.buttons   = btns;
                  if (data["show_contact_form"] == true) {
                    _messages.add(_Message(
                      role:     "bot",
                      type:     _MsgType.leadForm,
                      formLang: msgLang,
                    ));
                  }
                });
              }
            } catch (_) {}
          }
        }
        client.close();
      } else {
        setState(() {
          botMsg.text      = _T[_lang]!["error"]!;
          botMsg.streaming = false;
        });
      }
    } catch (e) {
      setState(() {
        botMsg.text      = _T[_lang]!["error"]!;
        botMsg.streaming = false;
      });
    } finally {
      setState(() => _isLoading = false);
      _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  // ── Build ──────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final isRtl = _lang == "ar";
    return Directionality(
      textDirection: isRtl ? TextDirection.rtl : TextDirection.ltr,
      child: Stack(
        children: [
          if (_isOpen)
            Positioned(
              bottom: 170,
              right:  isRtl ? null : 16,
              left:   isRtl ? 16   : null,
              width:  340,
              height: 520,
              child: SlideTransition(
                position: _slideAnim,
                child: _buildChatPanel(isRtl),
              ),
            ),
          Positioned(
            bottom: 90,
            right:  isRtl ? null : 20,
            left:   isRtl ? 20   : null,
            child: _buildFab(),
          ),
        ],
      ),
    );
  }

  // ── FAB ────────────────────────────────────────────────────────────────────
  Widget _buildFab() {
    return GestureDetector(
      onTap: _toggleChat,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 56, height: 56,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [_kOrange, _kOrangeDark],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: _kOrange.withValues(alpha:0.4),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Icon(
          _isOpen ? Icons.close_rounded : Icons.chat_bubble_outline_rounded,
          color: Colors.white,
          size: 26,
        ),
      ),
    );
  }

  // ── Chat Panel ─────────────────────────────────────────────────────────────
  Widget _buildChatPanel(bool isRtl) {
    return Material(
      elevation: 16,
      borderRadius: BorderRadius.circular(20),
      shadowColor: Colors.black26,
      child: Container(
          width: 340,
          height: 520,
          decoration: BoxDecoration(
            color: const Color(0xFFFAFAF9),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            children: [
              _buildHeader(),
              Expanded(child: _buildMessageList(isRtl)),
              if (_isLoading && !_messages.any((m) => m.streaming))
                _buildTypingIndicator(),
              _buildInput(isRtl),
            ],
          ),
      ),
    );
  }

  // ── Header ─────────────────────────────────────────────────────────────────
  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [_kDark, _kDark2],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.only(
          topLeft:  Radius.circular(20),
          topRight: Radius.circular(20),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 38, height: 38,
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [_kOrange, _kOrangeDark]),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Center(
              child: Text("D", style: TextStyle(
                color: Colors.white, fontWeight: FontWeight.w800, fontSize: 17,
              )),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _T[_lang]!["title"]!,
                  style: const TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15,
                  ),
                ),
                Row(
                  children: [
                    Container(
                      width: 6, height: 6,
                      decoration: const BoxDecoration(
                        color: Color(0xFF4ADE80), shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      _T[_lang]!["subtitle"]!,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha:0.55), fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: _toggleChat,
            child: Container(
              width: 28, height: 28,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha:0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(Icons.close, color: Colors.white.withValues(alpha:0.7), size: 16),
            ),
          ),
        ],
      ),
    );
  }

  // ── Message List ───────────────────────────────────────────────────────────
  Widget _buildMessageList(bool isRtl) {
    return ListView.builder(
      controller: _scroll,
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 8),
      itemCount: _messages.length,
      itemBuilder: (context, index) {
        final msg = _messages[index];

        if (msg.type == _MsgType.leadForm) {
          return _buildLeadFormInline(msg.formLang);
        }

        return Column(
          crossAxisAlignment: msg.role == "user"
              ? (isRtl ? CrossAxisAlignment.start : CrossAxisAlignment.end)
              : (isRtl ? CrossAxisAlignment.end   : CrossAxisAlignment.start),
          children: [
            _buildBubble(msg, isRtl),
            if (msg.contactInfo.isNotEmpty)
              _buildContactCard(msg.contactInfo, isRtl),
            if (!msg.streaming && msg.buttons.isNotEmpty)
              _buildButtons(msg.buttons, isRtl),
            Padding(
              padding: const EdgeInsets.only(top: 2, bottom: 8, left: 4, right: 4),
              child: Text(
                "${msg.time.hour.toString().padLeft(2,'0')}:${msg.time.minute.toString().padLeft(2,'0')}",
                style: const TextStyle(fontSize: 9, color: Color(0xFFBBBBBB)),
              ),
            ),
          ],
        );
      },
    );
  }

  // ── Bubble ─────────────────────────────────────────────────────────────────
  Widget _buildBubble(_Message msg, bool isRtl) {
    final isUser   = msg.role == "user";
    final isMsgAr  = isRtl || _isArabicText(msg.text);

    return Container(
      margin: EdgeInsets.only(
        left:   isUser ? 40 : 0,
        right:  isUser ? 0  : 40,
        bottom: 4,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        gradient: isUser
            ? const LinearGradient(colors: [_kOrange, _kOrangeDark])
            : null,
        color: isUser ? null : Colors.white,
        borderRadius: BorderRadius.only(
          topLeft:     const Radius.circular(16),
          topRight:    const Radius.circular(16),
          bottomLeft:  Radius.circular(isUser ? 16 : 4),
          bottomRight: Radius.circular(isUser ? 4  : 16),
        ),
        border: isUser ? null : Border.all(color: _kBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha:isUser ? 0.15 : 0.06),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: isUser
          ? Text(
              msg.text,
              textDirection: isMsgAr ? TextDirection.rtl : TextDirection.ltr,
              style: const TextStyle(
                color: Colors.white, fontSize: 14, height: 1.5,
              ),
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildMarkdown(msg.text, isMsgAr),
                if (msg.streaming)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: _StreamingCursor(),
                  ),
              ],
            ),
    );
  }

  // ── Markdown ───────────────────────────────────────────────────────────────
  Widget _buildMarkdown(String text, bool isRtl) {
    return Directionality(
      textDirection: isRtl ? TextDirection.rtl : TextDirection.ltr,
      child: MarkdownBody(
        data: text,
        selectable: false,
        styleSheet: MarkdownStyleSheet(
          p: TextStyle(
            color: _kDark, fontSize: 13.5,
            height: isRtl ? 2.0 : 1.65,
            fontFamily: isRtl ? "Cairo" : null,
          ),
          strong: const TextStyle(
            color: _kDark, fontWeight: FontWeight.w700,
            backgroundColor: Color(0x18FF6B2B),
          ),
          em: const TextStyle(
            color: Color(0xFF555555), fontStyle: FontStyle.italic,
          ),
          h1: const TextStyle(
            color: _kDark, fontSize: 15, fontWeight: FontWeight.w800,
          ),
          h2: TextStyle(
            color: _kDark, fontSize: 14, fontWeight: FontWeight.w700,
            decoration: TextDecoration.underline,
            decorationColor: _kOrange.withValues(alpha:0.4),
          ),
          h3: const TextStyle(
            color: _kOrange, fontSize: 13.5, fontWeight: FontWeight.w700,
          ),
          listBullet: const TextStyle(color: _kOrange),
          code: const TextStyle(
            backgroundColor: Color(0x18FF6B2B),
            color: _kOrangeDark,
            fontFamily: "monospace",
            fontSize: 12,
          ),
          codeblockDecoration: BoxDecoration(
            color: const Color(0x0DFF6B2B),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: _kOrange.withValues(alpha:0.2)),
          ),
          blockquote: const TextStyle(
            color: Color(0xFF555555), fontSize: 13,
          ),
          blockquoteDecoration: BoxDecoration(
            border: Border(
              left:  isRtl ? BorderSide.none : BorderSide(color: _kOrange, width: 3),
              right: isRtl ? BorderSide(color: _kOrange, width: 3) : BorderSide.none,
            ),
            color: const Color(0x08FF6B2B),
            borderRadius: isRtl
                ? const BorderRadius.only(
                    topLeft:    Radius.circular(8),
                    bottomLeft: Radius.circular(8),
                  )
                : const BorderRadius.only(
                    topRight:    Radius.circular(8),
                    bottomRight: Radius.circular(8),
                  ),
          ),
        ),
      ),
    );
  }

  // ── Buttons ────────────────────────────────────────────────────────────────
  Widget _buildButtons(List<String> buttons, bool isRtl) {
    return Padding(
      padding: const EdgeInsets.only(top: 6, bottom: 2),
      child: Wrap(
        alignment: isRtl ? WrapAlignment.end : WrapAlignment.start,
        spacing: 6,
        runSpacing: 6,
        children: buttons.map((btn) {
          final isSupport = _kSupportLabels.contains(btn);
          return GestureDetector(
            onTap: () => _sendMessage(btn, clickedButton: btn),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
              decoration: BoxDecoration(
                color: isSupport ? _kOrangeLight : Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: _kOrange.withValues(alpha:isSupport ? 0.6 : 0.35),
                  width: isSupport ? 1.5 : 1,
                ),
                boxShadow: [
                  BoxShadow(
                    color: _kOrange.withValues(alpha:0.08),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Text(
                btn,
                style: TextStyle(
                  color: _kOrange,
                  fontSize: 12,
                  fontWeight: isSupport ? FontWeight.w700 : FontWeight.w600,
                  fontFamily: _isArabicText(btn) ? "Cairo" : null,
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  // ── Contact Card ───────────────────────────────────────────────────────────
  Widget _buildContactCard(Map<String, dynamic> info, bool isRtl) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _kOrangeLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kOrange.withValues(alpha:0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _T[_lang]!["contact_title"]!,
            style: const TextStyle(
              fontWeight: FontWeight.w700, fontSize: 13, color: _kOrange,
            ),
          ),
          const SizedBox(height: 8),
          if (info["email"] != null)
            _contactRow(Icons.email_outlined, info["email"]),
          if (info["phone"] != null)
            _contactRow(Icons.phone_outlined, info["phone"]),
        ],
      ),
    );
  }

  Widget _contactRow(IconData icon, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Container(
            width: 26, height: 26,
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [_kOrange, _kOrangeDark]),
              borderRadius: BorderRadius.circular(7),
            ),
            child: Icon(icon, color: Colors.white, size: 13),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontSize: 12.5, color: _kDark, fontWeight: FontWeight.w500),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  // ── Lead Form Inline ───────────────────────────────────────────────────────
  Widget _buildLeadFormInline(String formLang) {
    final isFormRtl = formLang == "ar";
    return Directionality(
      textDirection: isFormRtl ? TextDirection.rtl : TextDirection.ltr,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: _kOrange.withValues(alpha:0.15)),
          boxShadow: [
            BoxShadow(
              color: _kOrange.withValues(alpha:0.1),
              blurRadius: 20,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        clipBehavior: Clip.hardEdge,
        child: _LeadFormInline(
          sessionId: _sessionId,
          language:  formLang,
          apiBase:   _kApiBase,
          onSubmitted: () {
            final tLocal = _T[formLang]!;
            final successBtns = formLang == "ar"
                ? ["كيف يعمل ديفيدو", "استكشف الفرص", "تواصل مع الدعم"]
                : ["How Divido Works", "Explore Opportunities", "Contact Support"];
            setState(() {
              // Replace the lead form message with success message
              final idx = _messages.indexWhere(
                (m) => m.type == _MsgType.leadForm && m.formLang == formLang
              );
              if (idx >= 0) {
                _messages[idx] = _Message(
                  role:    "bot",
                  text:    tLocal["form_success"]!,
                  buttons: successBtns,
                );
              }
            });
            _scrollToBottom();
          },
        ),
      ),
    );
  }

  // ── Typing indicator ───────────────────────────────────────────────────────
  Widget _buildTypingIndicator() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Row(
        children: [
          _dot(0.6),
          const SizedBox(width: 4),
          _dot(0.4),
          const SizedBox(width: 4),
          _dot(0.2),
          const SizedBox(width: 8),
          Text(
            _T[_lang]!["typing"]!,
            style: const TextStyle(color: Color(0xFF888888), fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _dot(double opacity) => Container(
    width: 8, height: 8,
    decoration: BoxDecoration(
      color: _kOrange.withValues(alpha:opacity), shape: BoxShape.circle,
    ),
  );

  // ── Input ──────────────────────────────────────────────────────────────────
  Widget _buildInput(bool isRtl) {
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: _kBorder)),
        borderRadius: BorderRadius.only(
          bottomLeft:  Radius.circular(20),
          bottomRight: Radius.circular(20),
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _ctrl,
                  textDirection: isRtl ? TextDirection.rtl : TextDirection.ltr,
                  decoration: InputDecoration(
                    hintText: _T[_lang]!["placeholder"]!,
                    hintStyle: const TextStyle(color: Color(0xFFAAAAAA), fontSize: 13),
                    filled:     true,
                    fillColor:  _kGrey,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(20),
                      borderSide: BorderSide.none,
                    ),
                  ),
                  style: const TextStyle(fontSize: 14),
                  onSubmitted: _sendMessage,
                  textInputAction: TextInputAction.send,
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => _sendMessage(_ctrl.text),
                child: Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [_kOrange, _kOrangeDark],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: _kOrange.withValues(alpha:0.35),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Icon(
                    isRtl ? Icons.arrow_back_rounded : Icons.arrow_forward_rounded,
                    color: Colors.white, size: 20,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            _T[_lang]!["footer"]!,
            style: const TextStyle(fontSize: 9, color: Color(0xFFCCCCCC)),
          ),
        ],
      ),
    );
  }
}

// ── Streaming Cursor ──────────────────────────────────────────────────────────
class _StreamingCursor extends StatefulWidget {
  @override
  State<_StreamingCursor> createState() => _StreamingCursorState();
}

class _StreamingCursorState extends State<_StreamingCursor>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    )..repeat(reverse: true);
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) => Opacity(
        opacity: _ctrl.value,
        child: const Text("▋",
          style: TextStyle(color: _kOrange, fontSize: 14, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

// ── Inline Lead Form ──────────────────────────────────────────────────────────
class _LeadFormInline extends StatefulWidget {
  final String sessionId;
  final String language;
  final String apiBase;
  final VoidCallback onSubmitted;

  const _LeadFormInline({
    required this.sessionId,
    required this.language,
    required this.apiBase,
    required this.onSubmitted,
  });

  @override
  State<_LeadFormInline> createState() => _LeadFormInlineState();
}

class _LeadFormInlineState extends State<_LeadFormInline> {
  final _nameCtrl  = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  bool   _submitting = false;
  String _error      = "";

  Map<String, String> get _t => _T[widget.language]!;
  bool get _isRtl => widget.language == "ar";

  Future<void> _submit() async {
    final name  = _nameCtrl.text.trim();
    final email = _emailCtrl.text.trim();
    if (name.isEmpty || email.isEmpty || !email.contains("@")) {
      setState(() => _error = _t["form_error"]!);
      return;
    }
    setState(() { _submitting = true; _error = ""; });
    try {
      final res = await http.post(
        Uri.parse("${widget.apiBase}/chat/lead"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "session_id":      widget.sessionId,
          "name":            name,
          "email":           email,
          "phone":           _phoneCtrl.text.trim().isEmpty ? null : _phoneCtrl.text.trim(),
          "context_message": "Mobile app lead",
        }),
      ).timeout(const Duration(seconds: 10));
      if (res.statusCode == 200) {
        widget.onSubmitted();
      } else {
        setState(() { _error = _t["form_error"]!; _submitting = false; });
      }
    } catch (_) {
      setState(() { _error = _t["form_error"]!; _submitting = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: _isRtl ? TextDirection.rtl : TextDirection.ltr,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(14),
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [_kDark, _kDark2]),
            ),
            child: Row(
              children: [
                Container(
                  width: 38, height: 38,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [_kOrange, _kOrangeDark]),
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: const Icon(Icons.chat_bubble_outline_rounded,
                    color: Colors.white, size: 18),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: _isRtl
                        ? CrossAxisAlignment.end
                        : CrossAxisAlignment.start,
                    children: [
                      Text(_t["form_title"]!,
                        style: const TextStyle(
                          color: Colors.white, fontWeight: FontWeight.w800,
                          fontSize: 14, fontFamily: null,
                        )),
                      Text(_t["form_sub"]!,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha:0.5), fontSize: 11,
                        )),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Fields
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 4),
            child: Column(
              children: [
                _field(_nameCtrl,  _t["name_label"]!,   _t["name_hint"]!,   Icons.person_outline_rounded),
                const SizedBox(height: 10),
                _field(_emailCtrl, _t["email_label2"]!, _t["email_hint"]!,  Icons.email_outlined,
                    keyboardType: TextInputType.emailAddress),
                const SizedBox(height: 10),
                _field(_phoneCtrl, _t["phone_label2"]!, _t["phone_hint"]!,  Icons.phone_outlined,
                    keyboardType: TextInputType.phone),
              ],
            ),
          ),

          if (_error.isNotEmpty)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 14),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFFDECEA),
                borderRadius: BorderRadius.circular(8),
                border: Border(
                  left:  _isRtl ? BorderSide.none
                      : const BorderSide(color: Color(0xFFC0392B), width: 3),
                  right: _isRtl
                      ? const BorderSide(color: Color(0xFFC0392B), width: 3)
                      : BorderSide.none,
                ),
              ),
              child: Text(_error,
                style: const TextStyle(color: Color(0xFFC0392B), fontSize: 12),
                textAlign: _isRtl ? TextAlign.right : TextAlign.left,
              ),
            ),

          // Submit
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 16),
            child: GestureDetector(
              onTap: _submitting ? null : _submit,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 13),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: _submitting
                        ? [const Color(0xFFCCCCCC), const Color(0xFFAAAAAA)]
                        : [_kOrange, _kOrangeDark],
                  ),
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: _submitting ? [] : [
                    BoxShadow(
                      color: _kOrange.withValues(alpha:0.4),
                      blurRadius: 12, offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (_submitting)
                      const SizedBox(
                        width: 14, height: 14,
                        child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2,
                        ),
                      ),
                    if (_submitting) const SizedBox(width: 8),
                    Text(
                      _submitting ? _t["submitting"]! : "${_t["submit"]!} →",
                      style: const TextStyle(
                        color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _field(
    TextEditingController ctrl,
    String label,
    String hint,
    IconData icon, {
    TextInputType keyboardType = TextInputType.text,
  }) {
    return Column(
      crossAxisAlignment: _isRtl ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(
          fontSize: _isRtl ? 11.5 : 10.5,
          fontWeight: FontWeight.w600,
          color: const Color(0xFF999999),
          letterSpacing: _isRtl ? 0 : 0.6,
        )),
        const SizedBox(height: 5),
        TextField(
          controller:   ctrl,
          keyboardType: keyboardType,
          textDirection: _isRtl ? TextDirection.rtl : TextDirection.ltr,
          style: const TextStyle(fontSize: 13.5, color: _kDark),
          decoration: InputDecoration(
            hintText:  hint,
            hintStyle: const TextStyle(color: Color(0xFFC0C0C0), fontSize: 13),
            prefixIcon: Icon(icon, color: _kOrange, size: 18),
            filled:    true,
            fillColor: const Color(0xFFF8F7F5),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFFE8E8E8)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFFE8E8E8)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: _kOrange, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}