// ── Divido Chatbot — Flutter Widget ──────────────────────────────────────────
// Version: 2.0 (Phase 7 — Arabic + Lead Capture + Enhanced Markdown)
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

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_markdown/flutter_markdown.dart';

// ── Configuration ─────────────────────────────────────────────────────────────
const String _kApiBase = "http://10.0.2.2:8000"; // Android emulator
// const String _kApiBase = "https://your-production-domain.com/api/chat"; // Production

const Color _kOrange     = Color(0xFFFF6B2B);
const Color _kOrangeDark = Color(0xFFE84E0F);
const Color _kDark       = Color(0xFF1A1A1A);
const Color _kGrey       = Color(0xFFF5F5F5);
const Color _kBorder     = Color(0xFFEEEEEE);

// ── Translations ──────────────────────────────────────────────────────────────
const Map<String, Map<String, String>> _T = {
  "en": {
    "title":           "Divido Assistant",
    "subtitle":        "AI-powered support",
    "placeholder":     "Ask anything about Divido...",
    "send":            "Send",
    "typing":          "Divido is thinking...",
    "welcome":         "Hello! I'm Divido's AI Assistant.\n\nI can help you understand the platform, explore investment opportunities, and answer your questions about fractional real estate.",
    "error":           "Something went wrong. Please try again.",
    "contact_title":   "Talk to Our Team",
    "contact_sub":     "Our team is available to help you personally.",
    "email_label":     "Email",
    "phone_label":     "Phone",
    "form_title":      "Leave Your Details",
    "form_sub":        "We'll contact you within 24 hours.",
    "name_hint":       "Your name",
    "email_hint":      "your@email.com",
    "phone_hint":      "Phone number (optional)",
    "submit":          "Send Request",
    "submitting":      "Sending...",
    "form_success":    "Thank you! We'll be in touch soon.",
    "form_error":      "Please enter your name and a valid email.",
  },
  "ar": {
    "title":           "مساعد ديفيدو",
    "subtitle":        "دعم مدعوم بالذكاء الاصطناعي",
    "placeholder":     "اسأل أي شيء عن ديفيدو...",
    "send":            "إرسال",
    "typing":          "ديفيدو يفكر...",
    "welcome":         "مرحباً! أنا المساعد الذكي لمنصة ديفيدو.\n\nيمكنني مساعدتك في فهم المنصة، واستكشاف فرص الاستثمار، والإجابة على أسئلتك حول العقارات التجزيئية.",
    "error":           "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
    "contact_title":   "تحدث مع فريقنا",
    "contact_sub":     "فريقنا متاح لمساعدتك شخصياً.",
    "email_label":     "البريد الإلكتروني",
    "phone_label":     "الهاتف",
    "form_title":      "اترك بياناتك",
    "form_sub":        "سنتواصل معك خلال 24 ساعة.",
    "name_hint":       "اسمك",
    "email_hint":      "بريدك@الإلكتروني.com",
    "phone_hint":      "رقم الهاتف (اختياري)",
    "submit":          "إرسال الطلب",
    "submitting":      "جارٍ الإرسال...",
    "form_success":    "شكراً لك! سنتواصل معك قريباً.",
    "form_error":      "يرجى إدخال اسمك وبريد إلكتروني صحيح.",
  }
};

// ── Data Models ───────────────────────────────────────────────────────────────
class _Message {
  final String role; // "user" | "bot"
  final String text;
  final List<String> buttons;
  final bool showContactForm;
  final Map<String, dynamic> contactInfo;
  final DateTime time;

  _Message({
    required this.role,
    required this.text,
    this.buttons = const [],
    this.showContactForm = false,
    this.contactInfo = const {},
    DateTime? time,
  }) : time = time ?? DateTime.now();
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
  // ── State ──────────────────────────────────────────────────────────────────
  bool _isOpen         = false;
  bool _isLoading      = false;
  String _sessionId    = "";
  String _lang         = "en";

  final List<_Message> _messages    = [];
  final TextEditingController _ctrl = TextEditingController();
  final ScrollController _scroll   = ScrollController();
  late AnimationController _animCtrl;
  late Animation<double> _scaleAnim;

  // ── Init ───────────────────────────────────────────────────────────────────
  @override
  void initState() {
    super.initState();
    _lang = widget.language;

    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    );
    _scaleAnim = CurvedAnimation(
      parent: _animCtrl,
      curve: Curves.easeOutBack,
    );

    _loadSession();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _ctrl.dispose();
    _scroll.dispose();
    super.dispose();
  }

  // ── Session ────────────────────────────────────────────────────────────────
  Future<void> _loadSession() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _sessionId = prefs.getString("divido_session_id") ??
          DateTime.now().millisecondsSinceEpoch.toString();
    });
    await prefs.setString("divido_session_id", _sessionId);

    // Welcome message
    _messages.add(_Message(
      role: "bot",
      text: _T[_lang]!["welcome"]!,
      buttons: _lang == "ar"
          ? ["كيف يعمل ديفيدو", "استكشف الفرص", "تحتاج مساعدة؟", "الثقة والقانون"]
          : ["How Divido Works", "Explore Opportunities", "Need Help", "Trust & Legal"],
    ));
    if (mounted) setState(() {});
  }

  // ── Toggle chat ────────────────────────────────────────────────────────────
  void _toggleChat() {
    setState(() => _isOpen = !_isOpen);
    if (_isOpen) {
      _animCtrl.forward();
      Future.delayed(const Duration(milliseconds: 100), _scrollToBottom);
    } else {
      _animCtrl.reverse();
    }
  }

  // ── Detect Arabic ──────────────────────────────────────────────────────────
  bool _isArabicText(String text) {
    final arabicChars = text.runes.where(
      (r) => r >= 0x0600 && r <= 0x06FF
    ).length;
    return arabicChars / text.length.clamp(1, 9999) > 0.3;
  }

  // ── Send message ───────────────────────────────────────────────────────────
  Future<void> _sendMessage(String text, {String? clickedButton}) async {
    if (text.trim().isEmpty || _isLoading) return;

    // Auto-detect language
    String lang = _lang;
    if (_lang == "en" && _isArabicText(text)) lang = "ar";

    final userMsg = _Message(role: "user", text: text.trim());
    setState(() {
      _messages.add(userMsg);
      _isLoading = true;
    });
    _ctrl.clear();
    _scrollToBottom();

    try {
      final response = await http.post(
        Uri.parse("$_kApiBase/chat/message"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "message":        text.trim(),
          "session_id":     _sessionId,
          "clicked_button": clickedButton,
          "language":       lang,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(utf8.decode(response.bodyBytes));

        // Update session id if server created one
        if (data["session_id"] != null) {
          _sessionId = data["session_id"];
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString("divido_session_id", _sessionId);
        }

        final botMsg = _Message(
          role:             "bot",
          text:             data["message"] ?? _T[_lang]!["error"]!,
          buttons:          List<String>.from(data["suggested_buttons"] ?? []),
          showContactForm:  data["show_contact_form"] ?? false,
          contactInfo:      Map<String, dynamic>.from(data["contact_info"] ?? {}),
        );

        setState(() => _messages.add(botMsg));
      } else {
        _addError();
      }
    } catch (e) {
      _addError();
    } finally {
      setState(() => _isLoading = false);
      _scrollToBottom();
    }
  }

  void _addError() {
    setState(() => _messages.add(_Message(
      role: "bot",
      text: _T[_lang]!["error"]!,
    )));
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
          // ── Chat Panel ───────────────────────────────────────────────────
          if (_isOpen)
            ScaleTransition(
              scale: _scaleAnim,
              alignment: isRtl ? Alignment.bottomLeft : Alignment.bottomRight,
              child: _buildChatPanel(isRtl),
            ),

          // ── Floating Button ──────────────────────────────────────────────
          Positioned(
            bottom: 20,
            right: isRtl ? null : 20,
            left:  isRtl ? 20   : null,
            child: _buildFab(),
          ),
        ],
      ),
    );
  }

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
              color: _kOrange.withOpacity(0.4),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Icon(
          _isOpen ? Icons.close : Icons.chat_bubble_outline_rounded,
          color: Colors.white,
          size: 26,
        ),
      ),
    );
  }

  Widget _buildChatPanel(bool isRtl) {
    return Positioned(
      bottom: 90,
      right: isRtl ? null : 16,
      left:  isRtl ? 16   : null,
      child: Material(
        elevation: 16,
        borderRadius: BorderRadius.circular(20),
        shadowColor: Colors.black26,
        child: Container(
          width: 340,
          height: 560,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            children: [
              _buildHeader(),
              Expanded(child: _buildMessageList(isRtl)),
              if (_isLoading) _buildTypingIndicator(),
              _buildInput(isRtl),
            ],
          ),
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
          colors: [_kDark, Color(0xFF2D2D2D)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(20),
          topRight: Radius.circular(20),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [_kOrange, _kOrangeDark],
              ),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.home_rounded, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _T[_lang]!["title"]!,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
                Text(
                  _T[_lang]!["subtitle"]!,
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.6),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: _toggleChat,
            child: Icon(Icons.close, color: Colors.white.withOpacity(0.7), size: 20),
          ),
        ],
      ),
    );
  }

  // ── Message List ───────────────────────────────────────────────────────────
  Widget _buildMessageList(bool isRtl) {
    return ListView.builder(
      controller: _scroll,
      padding: const EdgeInsets.all(12),
      itemCount: _messages.length,
      itemBuilder: (context, index) {
        final msg = _messages[index];
        return Column(
          crossAxisAlignment: msg.role == "user"
              ? (isRtl ? CrossAxisAlignment.start : CrossAxisAlignment.end)
              : (isRtl ? CrossAxisAlignment.end   : CrossAxisAlignment.start),
          children: [
            _buildBubble(msg, isRtl),
            if (msg.showContactForm && msg.contactInfo.isNotEmpty)
              _buildContactCard(msg.contactInfo, isRtl),
            if (msg.buttons.isNotEmpty)
              _buildButtons(msg.buttons, isRtl),
            const SizedBox(height: 8),
          ],
        );
      },
    );
  }

  // ── Message Bubble ─────────────────────────────────────────────────────────
  Widget _buildBubble(_Message msg, bool isRtl) {
    final isUser = msg.role == "user";

    return Container(
      margin: EdgeInsets.only(
        left:  isUser ? 40 : 0,
        right: isUser ? 0  : 40,
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
            color: Colors.black.withOpacity(isUser ? 0.15 : 0.06),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: isUser
          ? Text(
              msg.text,
              style: const TextStyle(color: Colors.white, fontSize: 14, height: 1.5),
            )
          : _buildMarkdown(msg.text, isRtl),
    );
  }

  // ── Markdown Renderer ──────────────────────────────────────────────────────
  Widget _buildMarkdown(String text, bool isRtl) {
    return MarkdownBody(
      data: text,
      selectable: false,
      styleSheet: MarkdownStyleSheet(
        p: TextStyle(
          color: _kDark, fontSize: 13.5, height: 1.65,
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
          decorationColor: _kOrange.withOpacity(0.4),
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
          border: Border.all(color: _kOrange.withOpacity(0.2)),
        ),
        blockquote: const TextStyle(color: Color(0xFF555555), fontSize: 13),
        blockquoteDecoration: BoxDecoration(
          border: Border(left: BorderSide(color: _kOrange, width: 3)),
          color: const Color(0x08FF6B2B),
          borderRadius: const BorderRadius.only(
            topRight: Radius.circular(8),
            bottomRight: Radius.circular(8),
          ),
        ),
        // Ordered list items styled with orange numbering background
        orderedListAlign: WrapAlignment.start,
        unorderedListAlign: WrapAlignment.start,
      ),
    );
  }

  // ── Action Buttons ─────────────────────────────────────────────────────────
  Widget _buildButtons(List<String> buttons, bool isRtl) {
    return Padding(
      padding: const EdgeInsets.only(top: 6, bottom: 4),
      child: Wrap(
        alignment: isRtl ? WrapAlignment.end : WrapAlignment.start,
        spacing: 6,
        runSpacing: 6,
        children: buttons.map((btn) {
          return GestureDetector(
            onTap: () => _sendMessage(btn, clickedButton: btn),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: _kOrange.withOpacity(0.5)),
                boxShadow: [
                  BoxShadow(
                    color: _kOrange.withOpacity(0.08),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Text(
                btn,
                style: const TextStyle(
                  color: _kOrange, fontSize: 12, fontWeight: FontWeight.w600,
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
        color: const Color(0xFFFFF8F5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kOrange.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _T[_lang]!["contact_title"]!,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: _kDark),
          ),
          const SizedBox(height: 4),
          Text(
            _T[_lang]!["contact_sub"]!,
            style: const TextStyle(fontSize: 12, color: Color(0xFF666666)),
          ),
          const SizedBox(height: 10),
          if (info["email"] != null)
            _contactRow(Icons.email_outlined, _T[_lang]!["email_label"]!, info["email"]),
          if (info["phone"] != null)
            _contactRow(Icons.phone_outlined, _T[_lang]!["phone_label"]!, info["phone"]),
          const SizedBox(height: 10),
          GestureDetector(
            onTap: () => _showLeadForm(context),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 9),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [_kOrange, _kOrangeDark]),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                _T[_lang]!["form_title"]!,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _contactRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Icon(icon, size: 15, color: _kOrange),
          const SizedBox(width: 6),
          Text(
            "$label: ",
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _kDark),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontSize: 12, color: Color(0xFF444444)),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  // ── Lead Form (Modal) ──────────────────────────────────────────────────────
  void _showLeadForm(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _LeadFormSheet(
        sessionId: _sessionId,
        language: _lang,
        apiBase: _kApiBase,
      ),
    );
  }

  // ── Typing Indicator ───────────────────────────────────────────────────────
  Widget _buildTypingIndicator() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Row(
        children: [
          Container(
            width: 8, height: 8,
            margin: const EdgeInsets.only(right: 4),
            decoration: BoxDecoration(
              color: _kOrange.withOpacity(0.6),
              shape: BoxShape.circle,
            ),
          ),
          Container(
            width: 8, height: 8,
            margin: const EdgeInsets.only(right: 4),
            decoration: BoxDecoration(
              color: _kOrange.withOpacity(0.4),
              shape: BoxShape.circle,
            ),
          ),
          Container(
            width: 8, height: 8,
            decoration: BoxDecoration(
              color: _kOrange.withOpacity(0.2),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            _T[_lang]!["typing"]!,
            style: const TextStyle(color: Color(0xFF888888), fontSize: 12),
          ),
        ],
      ),
    );
  }

  // ── Input Row ──────────────────────────────────────────────────────────────
  Widget _buildInput(bool isRtl) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: _kBorder)),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(20),
          bottomRight: Radius.circular(20),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _ctrl,
              textDirection: isRtl ? TextDirection.rtl : TextDirection.ltr,
              decoration: InputDecoration(
                hintText: _T[_lang]!["placeholder"]!,
                hintStyle: const TextStyle(color: Color(0xFFAAAAAA), fontSize: 13),
                filled: true,
                fillColor: _kGrey,
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
                    color: _kOrange.withOpacity(0.35),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Icon(
                isRtl ? Icons.arrow_back_rounded : Icons.arrow_forward_rounded,
                color: Colors.white,
                size: 20,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Lead Form Bottom Sheet ─────────────────────────────────────────────────────
class _LeadFormSheet extends StatefulWidget {
  final String sessionId;
  final String language;
  final String apiBase;

  const _LeadFormSheet({
    required this.sessionId,
    required this.language,
    required this.apiBase,
  });

  @override
  State<_LeadFormSheet> createState() => _LeadFormSheetState();
}

class _LeadFormSheetState extends State<_LeadFormSheet> {
  final _nameCtrl  = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  bool _submitting = false;
  bool _submitted  = false;
  String _error    = "";

  String get _t => widget.language;

  Future<void> _submit() async {
    final name  = _nameCtrl.text.trim();
    final email = _emailCtrl.text.trim();

    if (name.isEmpty || email.isEmpty || !email.contains("@")) {
      setState(() => _error = _T[_t]!["form_error"]!);
      return;
    }

    setState(() { _submitting = true; _error = ""; });

    try {
      final response = await http.post(
        Uri.parse("${widget.apiBase}/chat/lead"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "session_id":      widget.sessionId,
          "name":            name,
          "email":           email,
          "phone":           _phoneCtrl.text.trim().isEmpty ? null : _phoneCtrl.text.trim(),
          "context_message": "Mobile app lead",
        }),
      );

      if (response.statusCode == 200) {
        setState(() { _submitted = true; _submitting = false; });
      } else {
        setState(() { _error = _T[_t]!["form_error"]!; _submitting = false; });
      }
    } catch (_) {
      setState(() { _error = _T[_t]!["form_error"]!; _submitting = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isRtl = widget.language == "ar";

    return Directionality(
      textDirection: isRtl ? TextDirection.rtl : TextDirection.ltr,
      child: Container(
        padding: EdgeInsets.fromLTRB(
          24, 24, 24,
          MediaQuery.of(context).viewInsets.bottom + 24,
        ),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(24),
            topRight: Radius.circular(24),
          ),
        ),
        child: _submitted ? _buildSuccess() : _buildForm(isRtl),
      ),
    );
  }

  Widget _buildSuccess() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.check_circle_rounded, color: Color(0xFF27AE60), size: 56),
        const SizedBox(height: 16),
        Text(
          _T[_t]!["form_success"]!,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: _kDark),
        ),
        const SizedBox(height: 20),
        GestureDetector(
          onTap: () => Navigator.pop(context),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 13),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [_kOrange, _kOrangeDark]),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              "✓ Done",
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildForm(bool isRtl) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Drag handle
        Center(
          child: Container(
            width: 40, height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFFDDDDDD),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ),
        const SizedBox(height: 20),

        // Header
        Row(
          children: [
            Container(
              width: 38, height: 38,
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [_kOrange, _kOrangeDark]),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.support_agent_rounded, color: Colors.white, size: 20),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _T[_t]!["form_title"]!,
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: _kDark),
                ),
                Text(
                  _T[_t]!["form_sub"]!,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF888888)),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 22),

        // Fields
        _inputField(_nameCtrl,  _T[_t]!["name_hint"]!,  Icons.person_outline_rounded,  isRtl),
        const SizedBox(height: 12),
        _inputField(_emailCtrl, _T[_t]!["email_hint"]!, Icons.email_outlined,           isRtl, keyboardType: TextInputType.emailAddress),
        const SizedBox(height: 12),
        _inputField(_phoneCtrl, _T[_t]!["phone_hint"]!, Icons.phone_outlined,           isRtl, keyboardType: TextInputType.phone),

        if (_error.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Text(_error, style: const TextStyle(color: Color(0xFFC0392B), fontSize: 13)),
          ),

        const SizedBox(height: 20),

        // Submit button
        GestureDetector(
          onTap: _submitting ? null : _submit,
          child: Container(
            width: double.infinity,
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
                  color: _kOrange.withOpacity(0.35),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Text(
              _submitting ? _T[_t]!["submitting"]! : _T[_t]!["submit"]!,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _inputField(
    TextEditingController ctrl,
    String hint,
    IconData icon,
    bool isRtl, {
    TextInputType keyboardType = TextInputType.text,
  }) {
    return TextField(
      controller: ctrl,
      keyboardType: keyboardType,
      textDirection: isRtl ? TextDirection.rtl : TextDirection.ltr,
      style: const TextStyle(fontSize: 14, color: _kDark),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Color(0xFFAAAAAA), fontSize: 13),
        prefixIcon: Icon(icon, color: _kOrange, size: 20),
        filled: true,
        fillColor: const Color(0xFFFAFAFA),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _kBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _kBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _kOrange, width: 1.5),
        ),
      ),
    );
  }
}