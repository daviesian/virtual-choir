// Allows multiple inclusion under different namespaces, to compare configurations
#ifndef NUMERIC_NAMESPACE
#define NUMERIC_NAMESPACE numeric
#endif
#if (!defined (NUMERIC_NAMESPACE_INCLUDED_AS) || NUMERIC_NAMESPACE != NUMERIC_NAMESPACE_INCLUDED_AS)
#define NUMERIC_NAMESPACE_INCLUDED_AS NUMERIC_NAMESPACE

#include <array>
#include <initializer_list>
#include <memory>
#include <iterator>
#include <cassert>

#include <cmath> // for abs/sin/etc.

namespace NUMERIC_NAMESPACE {

// Variadic macro arguments are standard since C++11
#define NUMERIC_UNPACK(...) __VA_ARGS__
// Variadic macro arguments are standard since C++11
#define NUMERIC_IGNORE(...)

	/* SizeInfo family
	
	Each one has:
		public .size() const
		static const .sizeStep and .sizeMax

	They are copyable and assignable using the default methods.
	*/
	template<size_t constantSize>
	struct SizeFixed {
		SizeFixed() {}
		SizeFixed(size_t size) {
			assert(size == constantSize);
		}
		size_t size() const {
			return constantSize;
		}
		static const size_t sizeStep = constantSize;
		static const size_t sizeMax = constantSize;
		static const size_t sizeDefault = constantSize;
	};
	template <size_t max, size_t divisor=1>
	class SizeBounded {
		size_t _size;
	public:
		SizeBounded(size_t size) : _size(size > max ? max : size) {
			assert(size == (size/divisor)*divisor);
			assert(size <= max);
		}
		size_t size() const {
			return _size;
		}
		static const size_t sizeStep = divisor;
		static const size_t sizeMax = max;
		static const size_t sizeDefault = 0;
	};
	template <size_t divisor=1>
	class SizeFinite {
		size_t _size;
	public:
		SizeFinite(size_t size) : _size(size) {
			assert(size == (size/divisor)*divisor);
		}
		size_t size() const {
			return _size;
		}
		static const size_t sizeStep = divisor;
		static const size_t sizeMax = SIZE_MAX;
		static const size_t sizeDefault = 0;
	};

	constexpr size_t hcf(size_t a, size_t b) {
		return a == 0 ? b : hcf(b%a, a);
	}

	// Overloaded/templated function to get minimum of two sizes
	// Fixed + Fixed
	template<size_t fixedA, size_t fixedB>
	SizeFixed<(fixedA < fixedB ? fixedA : fixedB)> sizeMinimum(const SizeFixed<fixedA> &, const SizeFixed<fixedB> &) {
		return SizeFixed<(fixedA < fixedB ? fixedA : fixedB)>();
	}
	// Fixed + Bounded
	template<size_t maxA, size_t divisorA, size_t fixedB>
	SizeBounded<(maxA < fixedB ? maxA : fixedB), hcf(divisorA, (maxA <= fixedB ? divisorA : fixedB))> sizeMinimum(const SizeBounded<maxA, divisorA> &bounded, const SizeFixed<fixedB> &fixed) {
		return std::min(fixed.size(), bounded.size());
	}
	template<size_t fixedA, size_t maxB, size_t divisorB>
	SizeBounded<(maxB < fixedA ? maxB : fixedA), hcf(divisorB, (maxB <= fixedA ? divisorB : fixedA))> sizeMinimum(const SizeBounded<fixedA> &fixed, const SizeBounded<maxB, divisorB> &bounded) {
		return std::min(fixed.size(), bounded.size());
	}
	// Fixed + Finite
	template<size_t divisorA, size_t fixedB>
	SizeBounded<fixedB, hcf(divisorA, fixedB)> sizeMinimum(const SizeFinite<divisorA> &finite, const SizeFixed<fixedB> &fixed) {
		return std::min(fixed.size(), finite.size());
	}
	template<size_t fixedA, size_t divisorB>
	SizeBounded<fixedA, hcf(fixedA, divisorB)> sizeMinimum(const SizeFixed<fixedA> &fixed, const SizeFinite<divisorB> &finite) {
		return std::min(fixed.size(), finite.size());
	}
	// Bounded + Bounded
	template<size_t maxA, size_t divisorA, size_t maxB, size_t divisorB>
	SizeBounded<(maxA < maxB ? maxA : maxB), (maxA < divisorB ? divisorA : maxB < divisorA ? divisorB : hcf(divisorA, divisorB))> sizeMinimum(const SizeBounded<maxA, divisorA> &a, const SizeBounded<maxB, divisorB> &b) {
		return std::min(a.size(), b.size());
	}
	// Bounded + Finite
	template<size_t maxA, size_t divisorA, size_t divisorB>
	SizeBounded<maxA, (maxA < divisorB ? divisorA : hcf(divisorA, divisorB))> sizeMinimum(const SizeBounded<maxA, divisorA> &a, const SizeFinite<divisorB> &b) {
		return std::min(a.size(), b.size());
	}
	template<size_t divisorA, size_t maxB, size_t divisorB>
	SizeBounded<maxB, (maxB < divisorA ? divisorB : hcf(divisorA, divisorB))> sizeMinimum(const SizeFinite<divisorA> &a, const SizeBounded<maxB, divisorB> &b) {
		return std::min(a.size(), b.size());
	}
	// Finite + Finite
	template<size_t divisorA, size_t divisorB>
	SizeFinite<hcf(divisorA, divisorB)> sizeMinimum(const SizeFinite<divisorA> &a, const SizeFinite<divisorB> &b) {
		return std::min(a.size(), b.size());
	}

	// Template to get minimum SizeInfo class
	template<typename SizeA, typename SizeB>
	using SizeMinimum = decltype(sizeMinimum(std::declval<SizeA>(), std::declval<SizeB>()));

	// Overloaded function to get divided size
	template<size_t fixedStride, size_t fixedA>
	SizeFixed<fixedA/fixedStride> sizeDivide(const SizeFixed<fixedA> &a) {
		return a.size()/fixedStride;
	}
	template<size_t fixedStride, size_t maxA, size_t divisorA>
	SizeBounded<maxA/fixedStride, ((divisorA/fixedStride*fixedStride == divisorA) ? divisorA/fixedStride : 1)> sizeDivide(const SizeBounded<maxA, divisorA> &a) {
		return a.size()/fixedStride;
	}
	template<size_t fixedStride, size_t divisorA>
	SizeFinite<((divisorA/fixedStride*fixedStride == divisorA) ? divisorA/fixedStride : 1)> sizeDivide(const SizeFinite<divisorA> &a) {
		return a.size()/fixedStride;
	}

	// Template to get divided SizeInfo class
	template<typename SizeA, size_t stride>
	using SizeDivide = decltype(sizeDivide<stride>(std::declval<SizeA>()));

	/* Storage classes

	These can be constructed from:
		- a size
		- an iterator (random-access or input, tagged as such)
		- a copy

	They must define operator[] and .begin().  They probably define end() as well.
	*/

	template <typename Item, typename SizeInfo>
	class DirectStorage : public SizeInfo {
		typename std::aligned_storage<sizeof(Item), alignof(Item)>::type data[SizeInfo::sizeMax];

	protected:
		template<typename Iterator>
		void assign(size_t otherSize, const Iterator& other, std::random_access_iterator_tag) {
			return assign(otherSize, other, std::input_iterator_tag());
		}
		template<typename Iterator>
		void assign( size_t otherSize, Iterator other, std::input_iterator_tag) {
			size_t commonSize = otherSize < this->size() ? otherSize : this->size();
			for (size_t pos = 0; pos < commonSize; ++pos) {
				(*this)[pos] = *other;
				++other;
			}
			for (size_t pos = this->size(); pos < otherSize; ++pos) {
				// Construct additional pylons
				::new (&data[pos]) Item(*other);
				++other;
			}
			for (size_t pos = otherSize; pos < this->size(); ++pos) {
				// Destroy surplus items
				(*this)[pos].~Item();
			}
			((SizeInfo&)*this) = otherSize;
		}
	public:
		DirectStorage(size_t size) : SizeInfo(size) {
			for (size_t pos = 0; pos < this->size(); ++pos) {
				::new (&data[pos]) Item();
			}
		}
		template<typename Iterator>
		DirectStorage(size_t size, Iterator iterator, std::random_access_iterator_tag) : SizeInfo(size) {
			for (size_t pos = 0; pos < this->size(); ++pos) {
				::new (&data[pos]) Item(iterator[pos]);
			}
		}
		template<typename Iterator>
		DirectStorage(size_t size, Iterator iterator, std::input_iterator_tag) : SizeInfo(size) {
			for (size_t pos = 0; pos < this->size(); ++pos) {
				::new (&data[pos]) Item(*iterator);
				++iterator;
			}
		}

		// Shouldn't need these - derived classes should use .assign()
		DirectStorage(const DirectStorage& other)= delete;
		DirectStorage(DirectStorage&& other) = delete;
		DirectStorage & operator=(const DirectStorage& other) = delete;
		DirectStorage & operator=(DirectStorage&& other) = delete;

		~DirectStorage() {
			for (size_t i = 0; i < this->size(); i++) {
				(*this)[i].~Item();
			}
		}

		const Item& operator[] (size_t i) const {
			return *reinterpret_cast<const Item*>(&data[i]);
		}
		Item& operator[] (size_t i) {
			return *reinterpret_cast<Item*>(&data[i]);
		}
		const Item* begin() const {
			return &(*this)[0];
		}
		Item* begin() {
			return &(*this)[0];
		}
		const Item* end() const {
			return &(*this)[this->size()];
		}
	};

	template <typename Item, typename SizeInfo>
	class HeapStorage : public SizeInfo {
		using aligned_data = typename std::aligned_storage<sizeof(Item), alignof(Item)>::type;
		aligned_data *data;

		void releaseData() {
			if (data != nullptr) {
				for (size_t i = 0; i < this->size(); i++) {
					(*this)[i].~Item();
				}
				delete[] data;
			}
		}
	protected:
		template<typename Iterator>
		void assign(size_t otherSize, const Iterator& other, std::random_access_iterator_tag) {
			return assign(otherSize, other, std::input_iterator_tag());
		}
		template<typename Iterator>
		void assign(size_t otherSize, Iterator other, std::input_iterator_tag) {
			if (otherSize == this->size()) {
				for (size_t pos = 0; pos < this->size(); ++pos) {
					(*this)[pos] = *other;
					++other;
				}
			} else {
				releaseData();

				((SizeInfo&)*this) = otherSize;

				data = new aligned_data[this->size()];
				for (size_t pos = 0; pos < this->size(); ++pos) {
					::new (&data[pos]) Item(*other);
					++other;
				}
			}
		};
		// void assign(HeapStorage&& other) {
		// 	using std::swap;
		// 	swap((SizeInfo&)*this, (SizeInfo&)other);
		// 	swap(data, other.data);
		// 	return *this;
		// };
	public:
		HeapStorage(size_t size) : SizeInfo(size), data(new aligned_data[this->size()]) {
			for (size_t pos = 0; pos < this->size(); ++pos) {
				::new (&data[pos]) Item();
			}
		}
		template<typename Iterator>
		HeapStorage(size_t size, Iterator iterator, std::random_access_iterator_tag) : SizeInfo(size), data(new aligned_data[this->size()]) {
			// std::cout << "constructing from random-access iterator\n";
			for (size_t pos = 0; pos < this->size(); ++pos) {
				::new (&data[pos]) Item(iterator[pos]);
			}
		}
		template<typename Iterator>
		HeapStorage(size_t size, Iterator iterator, std::input_iterator_tag) : SizeInfo(size), data(new aligned_data[this->size()]) {
			for (size_t pos = 0; pos < this->size(); ++pos) {
				::new (&data[pos]) Item(*iterator);
				++iterator;
			}
		}

		// Shouldn't need these - derived classes should use .assign()
		HeapStorage(const HeapStorage& other) = delete;
		HeapStorage(HeapStorage&& other) = delete;
		HeapStorage & operator=(const HeapStorage& other) = delete;
		HeapStorage & operator=(HeapStorage&& other) = delete;

		~HeapStorage() {
			if (data != nullptr) {
				for (size_t i = 0; i < this->size(); i++) {
					(*this)[i].~Item();
				}
				delete[] data;
			}
		}

		const Item& operator[] (size_t i) const {
			return *reinterpret_cast<const Item*>(&data[i]);
		}
		Item& operator[] (size_t i) {
			return *reinterpret_cast<Item*>(&data[i]);
		}
		const Item* begin() const {
			return &(*this)[0];
		}
		Item* begin() {
			return &(*this)[0];
		}
		const Item* end() const {
			return &(*this)[this->size()];
		}
	};

	template<typename SizeInfo, typename DeferredIterator, typename=void>
	class IteratorStorage : public SizeInfo {
		using Value = decltype(*std::declval<DeferredIterator>());
		DeferredIterator iterator;
	public:
		IteratorStorage(size_t size, const DeferredIterator &iterator, std::random_access_iterator_tag) : SizeInfo(size), iterator(iterator) {}

		Value operator[] (size_t i) const {
			return iterator[i];
		}

		DeferredIterator begin() const {
			return iterator;
		}
		DeferredIterator end() const {
			return iterator + this->size();
		}
	};

	// SFINAE specialisation for writeable iterators
	template<typename SizeInfo, typename DeferredIterator>
	class IteratorStorage<SizeInfo, DeferredIterator, decltype(void(std::declval<DeferredIterator>()[0] = std::declval<DeferredIterator>()[0]))>
			: public IteratorStorage<SizeInfo, DeferredIterator, int> { // Inherit from arbitrary un-specialised version
	protected:
		template<typename Iterator>
		void assign(size_t otherSize, const Iterator& other, std::random_access_iterator_tag) {
			return assign(otherSize, other, std::input_iterator_tag());
		}
		template<typename Iterator>
		void assign(size_t otherSize, Iterator other, std::input_iterator_tag) {
			size_t commonSize = otherSize < this->size() ? otherSize : this->size();
			for (size_t pos = 0; pos < commonSize; ++pos) {
				(*this)[pos] = *other;
				++other;
			}
		};

	public:
		using IteratorStorage<SizeInfo, DeferredIterator, int>::IteratorStorage;
	};

	/* Strategy template

	A strategy is a template which, when specialised with item/size, returns a Storage implementation (class) as Strategy::Storage
	*/
	template<typename Item, typename SizeInfo>
	struct DirectStrategy;
	template<typename Item, size_t size>
	struct DirectStrategy<Item, SizeFixed<size>> {
		using Storage = DirectStorage<Item, SizeFixed<size>>;

		static_assert(sizeof(Storage) == sizeof(Item[size]), "DirectStorage with SizeFixed should be exactly the size of the underlying array");
	};
	template<typename Item, size_t sizeMax, size_t sizeDivisor>
	struct DirectStrategy<Item, SizeBounded<sizeMax, sizeDivisor>> {
		using Storage = DirectStorage<Item, SizeBounded<sizeMax, sizeDivisor>>;
	};
	template<typename Item, size_t divisor>
	struct DirectStrategy<Item, SizeFinite<divisor>> {
		using Storage = HeapStorage<Item, SizeFinite<divisor>>;
	};

	template<typename Value>
	struct ConstantIterator {
		const Value value;
		ConstantIterator(const Value& value) : value(value) {};
		const Value& operator * () const {
			return value;
		}
		const Value& operator [] (size_t) const {
			return value;
		}
		ConstantIterator & operator++ () {
			return *this;
		}
		ConstantIterator operator + (int) {
			return *this;
		}
	};
	template<typename Value=size_t>
	struct RangeIterator {
		Value v = 0;
		RangeIterator(Value v) : v(v) {};
		const Value& operator * () const {
			return v;
		}
		const Value& operator [] (size_t i) const {
			return v + i;
		}
		RangeIterator & operator++ () {
			++v;
			return *this;
		}
		RangeIterator operator + (int i) {
			return RangeIterator(v + i);
		}
	};
	template<typename Iterator, int fixedStep=0>
	class SliceIterator {
		using Value = decltype(*std::declval<Iterator>());
		Iterator iterator;
		int step;
	public:
		SliceIterator(const Iterator& iterator, int step) : iterator(iterator), step(step) {}
		Value operator * () const {
			return *iterator;
		}
		Value operator [] (size_t i) const {
			return iterator[i*step];
		}
		SliceIterator & operator++() {
			iterator += step;
			return *this;
		}
		SliceIterator & operator += (int i) {
			iterator += i*step;
			return *this;
		}
		SliceIterator operator + (int i) const {
			return SliceIterator(iterator + i*step, step);
		}
		/*
		SliceIterator & crossIncrement(size_t i) {
			iterator += i;
			return *this;
		}
		SliceIterator crossAdd(int i) const {
			return SliceIterator(iterator + i, step);
		}
		*/
	};
	/*
	template<typename Iterator, typename SizeInfo, template<typename,typename> StorageStrategy>
	class StripeArrayIterator : SizeInfo {
		using Value = decltype(*std::declval<Iterator>());
		using ArrayValue = Array<Value, SizeInfo, StorageStrategy, Iterator>;
		Iterator iterator;
		size_t crossStep;
		SizeInfo sizeInfo;
	public:
		StripeArrayIterator(const Iterator& iterator, size_t size, size_t crossStep) : SizeInfo(size), iterator(iterator), crossStep(crossStep) {}
		ArrayValue operator*() const {
			return ArrayValue(size, iterator, std::random_access_iterator_tag);
		}
		ArrayValue operator[](size_t i) const {
			return ArrayValue(size, iterator.crossAdd(i*crossStep), std::random_access_iterator_tag);
		}
		StripeArrayIterator & operator++() {
			iterator.crossIncrement(crossStep);
			return *this;
		}
		StripeArrayIterator & operator+=(int i) {
			iterator.crossIncrement(i*crossStep);
			return *this;
		}
		StripeArrayIterator operator+(int i) {
			return StripeArrayIterator(iterator.crossAdd(i*crossStep), this->size(), crossStep);
		}
		StripeArrayIterator & crossIncrement(size_t i) {
			iterator.crossIncrement(i);
			return &this;
		}
		StripeArrayIterator crossAdd(int i) {
			return StripeArrayIterator(iterator.crossAdd(i), this->size(), crossStep);
		}
	}
	*/
 
	/* Expression classes/templates

	These macros define BinaryExpression... and UnaryExpression... classes for each non-assignment
	operator.  The result is enough like a random-access iterator that it can be used to construct
	Arrays (stored or deferred).  They store similar random-access-ish iterators, so can be used to
	construct complex expressions.

	*/
	namespace operators {
#define NUMERIC_BINARY_EXPRESSION(Operator, Suffix) \
		template<typename Left, typename Right> \
		static auto binaryRight##Suffix(Left left, Right right) -> decltype(left Operator right) { \
			return left Operator right; \
		} \
		template<typename Left, typename Right> \
		static auto binaryLeft##Suffix(Right right, Left left) -> decltype(left Operator right) { \
			return left Operator right; \
		}

		NUMERIC_BINARY_EXPRESSION(+, Plus)
		NUMERIC_BINARY_EXPRESSION(-, Minus)
		NUMERIC_BINARY_EXPRESSION(*, Multiply)
		NUMERIC_BINARY_EXPRESSION(/, Divide)
		NUMERIC_BINARY_EXPRESSION(%, Modulo)

		NUMERIC_BINARY_EXPRESSION(&, BitAnd)
		NUMERIC_BINARY_EXPRESSION(|, BitOr)
		NUMERIC_BINARY_EXPRESSION(^, BitXor)
		NUMERIC_BINARY_EXPRESSION(<<, ShiftLeft)
		NUMERIC_BINARY_EXPRESSION(>>, ShiftRight)

		// Verbose method names for boolean comparisons - skip the left-scalar version
		NUMERIC_BINARY_EXPRESSION(==, Equal)
		NUMERIC_BINARY_EXPRESSION(!=, NotEqual)
		NUMERIC_BINARY_EXPRESSION(>, GreaterThan)
		NUMERIC_BINARY_EXPRESSION(<, LessThan)
		NUMERIC_BINARY_EXPRESSION(>=, GreaterThanEqual)
		NUMERIC_BINARY_EXPRESSION(<=, LessThanEqual)
#ifdef __cpp_impl_three_way_comparison
		NUMERIC_BINARY_EXPRESSION(<=>, Compare)
#endif
		NUMERIC_BINARY_EXPRESSION(&&, BoolAnd)
		NUMERIC_BINARY_EXPRESSION(||, BoolOr)

#define NUMERIC_UNARY_EXPRESSION(Operator, Suffix) \
		template<typename T> \
		auto unary##Suffix(T value) -> decltype(Operator value) { \
			return Operator value; \
		} \

		NUMERIC_UNARY_EXPRESSION(+, Plus)
		NUMERIC_UNARY_EXPRESSION(-, Minus)
		NUMERIC_UNARY_EXPRESSION(!, Not)
		NUMERIC_UNARY_EXPRESSION(~, BitNot)
	}

	/* Binary and unary operator methods/functions

	These macros are used inside the body of a class, to define the operators.  Left-binary operators
	(e.g. "0 + arr") are defined as friend functions.

	*/
	// First, pre-declare the output (Array) and input (ArrayBase) templates we'll be using
	template<typename Item, typename SizeInfo, template<typename,typename> class StorageStrategy, typename DeferredIterator>
	class ArrayBase;
	template<typename Item, typename SizeInfo, template<typename,typename> class StorageStrategy, typename DeferredIterator, typename=void>
	class ArrayWriteable;
	template<typename Item, typename SizeInfo, template<typename,typename> class StorageStrategy, typename DeferredIterator>
	using Array = ArrayWriteable<Item, SizeInfo, StorageStrategy, DeferredIterator>;

	// Returns ElseType, if IsVoid is not void
	template<typename IsVoid, typename ElseType>
	struct Voidable {
		using Type = ElseType;
	};
	template<typename ElseType>
	struct Voidable<void, ElseType> {
		using Type = void;
	};
	// Returns ElseType, if either of IsVoid1/IsVoid2 are not void
	template<typename IsVoid1, typename isVoid2, typename ElseType>
	struct Voidable2 {
		using Type = ElseType;
	};
	template<typename ElseType>
	struct Voidable2<void, void, ElseType> {
		using Type = void;
	};

#define NUMERIC_ASSIGNMENT_OP(Operator, funcName) \
	template<typename OtherItem, typename OtherSize, template<typename,typename> class OtherStrategy, typename OtherDeferred> \
	Array<Item, SizeInfo, StorageStrategy, DeferredIterator> & \
			funcName (const ArrayBase<OtherItem, OtherSize, OtherStrategy, OtherDeferred> &other) { \
		size_t commonSize = (other.size() < this->size() ? other.size() : this->size()); \
		for (size_t i = 0; i < commonSize; i++) { \
			(*this)[i] Operator other[i]; \
		} \
		return *this; \
	} \
	/* Enable operator with scalar, but only for non-array types */ \
	template<typename OtherItem> \
	typename std::enable_if<!is_numeric_array<OtherItem>::value, \
		Array<Item, SizeInfo, StorageStrategy, DeferredIterator> \
	>::type & funcName (const OtherItem &other) { \
		for (size_t i = 0; i < this->size(); i++) { \
			(*this)[i] Operator other; \
		} \
		return *this; \
	}

	// For a normal "can cast to type" we could do the cast directly in the SFINAE expression below
	// but since we're trying to match against a template, it wouldn't be able to guess all the parameters.
	// So, we define a (templated) function which only exists for the types we want, and use that.
	namespace _numeric_internal {
		template<typename Item, typename SizeInfo, template<typename,typename> class StorageStrategy, typename DeferredIterator>
		void onlyDefinedForArrays(const ArrayBase<Item, SizeInfo, StorageStrategy, DeferredIterator>&) {}
	}
	// Inspired by is_convertible, but for the Array<> template
	template<typename Candidate, typename=void>
	struct is_numeric_array : public std::false_type {};
	// template<typename Item, typename SizeInfo, template<typename,typename> class StorageStrategy>
	// struct is_numeric_array<ArrayBase<Item, SizeInfo, StorageStrategy>> : public std::true_type {};
	template<typename Candidate>
	struct is_numeric_array<Candidate, decltype(_numeric_internal::onlyDefinedForArrays(std::declval<Candidate>()))> : public std::true_type {};

	// ArrayBase is the first predictable class which can be indexed, so should be used for operands
	template<typename Item, typename SizeInfo, template<typename,typename> class StorageStrategy, typename DeferredIterator>
	class ArrayBase : public IteratorStorage<SizeInfo, DeferredIterator> {
	public:
		// Inherit all constructors
		using IteratorStorage<SizeInfo, DeferredIterator>::IteratorStorage;
	};

	template<typename Item, typename SizeInfo, template<typename,typename> class StorageStrategy>
	class ArrayBase<Item, SizeInfo, StorageStrategy, void> : public StorageStrategy<Item, SizeInfo>::Storage {
		using Storage = typename StorageStrategy<Item, SizeInfo>::Storage;
	public:
		// Inherit all constructors
		using Storage::Storage;

		ArrayBase() : Storage(SizeInfo::sizeDefault) {}
		ArrayBase(size_t size) : Storage(size) {}

		template<typename Iterator>
		ArrayBase(size_t size, Iterator begin, std::random_access_iterator_tag tag) : Storage(size, begin, tag) {}
	};

	template <typename Function, typename Subject>
	class MapExpressionFunction { \
		using ResultItem = decltype(std::declval<Function>()(*std::declval<Subject>())); \
		Function fn; \
		Subject subject; \
	public: \
		MapExpressionFunction (Function fn, Subject subject) : fn(fn), subject(subject) {} \
		const ResultItem operator*() const { \
			return fn(*subject);
		} \
		const ResultItem operator[](size_t i) const { \
			return fn(subject[i]);
		} \
		MapExpressionFunction & operator++() { \
			++subject; \
			return *this; \
		} \
		MapExpressionFunction operator +(int n) { \
			return MapExpressionFunction(fn, subject + n); \
		} \
	};

	template <typename Function, typename Subject, typename Subject2>
	class MapExpressionFunction2 { \
		using ResultItem = decltype(std::declval<Function>()(*std::declval<Subject>(), *std::declval<Subject2>())); \
		Function fn; \
		Subject subject; \
		Subject2 subject2; \
	public: \
		MapExpressionFunction2 (Function fn, Subject subject, Subject2 subject2) : fn(fn), subject(subject), subject2(subject2) {} \
		const ResultItem operator*() const { \
			return fn(*subject, *subject2);
		} \
		const ResultItem operator[](size_t i) const { \
			return fn(subject[i], subject2[i]);
		} \
		MapExpressionFunction2 & operator++() { \
			++subject; \
			++subject2; \
			return *this; \
		} \
		MapExpressionFunction2 operator+(int n) { \
			return MapExpressionFunction2(fn, subject + n, subject2 + n); \
		} \
	};

	template <typename ResultItem, typename Item, ResultItem(*Func)(Item), typename Subject>
	class MapExpressionExplicit { \
		Subject subject; \
	public: \
		MapExpressionExplicit (Subject subject) : subject(subject) {} \
		const ResultItem operator*() const { \
			return Func(*subject);
		} \
		const ResultItem operator[](size_t i) const { \
			return Func(subject[i]);
		} \
		MapExpressionExplicit & operator++() { \
			++subject; \
			return *this; \
		} \
		MapExpressionExplicit operator+(int n) { \
			return MapExpressionExplicit(subject + n); \
		} \
	};

	template <typename ResultItem, typename Item, typename Arg2, ResultItem(*Func)(Item, Arg2), typename Subject, typename Subject2>
	class MapExpressionExplicit2 { \
		Subject subject; \
		Subject2 subject2; \
	public: \
		MapExpressionExplicit2 (Subject subject, Subject2 subject2) : subject(subject), subject2(subject2) {} \
		const ResultItem operator*() const { \
			return Func(*subject, *subject2);
		} \
		const ResultItem operator[](size_t i) const { \
			return Func(subject[i], subject2[i]);
		} \
		MapExpressionExplicit2 & operator++() { \
			++subject; \
			++subject2; \
			return *this; \
		} \
		MapExpressionExplicit2 operator+(int n) { \
			return MapExpressionExplicit2(subject + n, subject2 + n); \
		} \
	};

	template<typename Item, typename SizeInfo, template<typename,typename> class StorageStrategy, typename DeferredIterator>
	class ArrayWithBinaryOperators : public ArrayBase<Item, SizeInfo, StorageStrategy, DeferredIterator> {
		using Base = ArrayBase<Item, SizeInfo, StorageStrategy, DeferredIterator>;
	public:
		using Base::ArrayBase;

		bool all() const {
			for (size_t i = 0; i < this->size(); ++i) {
				if (!(*this)[i]) return false;
			}
			return true;
		}
		bool any() const {
			for (size_t i = 0; i < this->size(); ++i) {
				if ((*this)[i]) return true;
			}
			return false;
		}

		// Generic form, which accepts lambdas and functors
		// It should be able to guess the FunctionType argument, if given the others
		template<typename Result, typename FunctionType>
		auto map(FunctionType fn) const \
			-> Array< \
				Result, SizeInfo, StorageStrategy, \
				typename Voidable<DeferredIterator, MapExpressionFunction<FunctionType, decltype(this->begin())>>::Type \
			> \
		{ \
			MapExpressionFunction<FunctionType, decltype(this->begin())> expr(fn, this->begin()); \
			Array< \
				Result, SizeInfo, StorageStrategy, \
				typename Voidable<DeferredIterator, MapExpressionFunction<FunctionType, decltype(this->begin())>>::Type \
			> result( \
				this->size(), \
				expr, \
				std::random_access_iterator_tag() \
			); \
			return result; \
		}
		// Two argument with scalar
		template<typename Result, typename Arg2, typename FunctionType>
		auto map(FunctionType fn, const Arg2 &arg2) const \
			/* Only support for non-array Arg2 */ \
			-> typename std::enable_if<!is_numeric_array<Arg2>::value, \
				Array< \
					Result, SizeInfo, StorageStrategy, \
					typename Voidable<DeferredIterator, MapExpressionFunction2<FunctionType, decltype(this->begin()), ConstantIterator<Arg2>>>::Type \
				> \
			>::type \
		{ \
			MapExpressionFunction2<FunctionType, decltype(this->begin()), ConstantIterator<Arg2>> expr(fn, this->begin(), ConstantIterator<Arg2>(arg2)); \
			Array< \
				Result, SizeInfo, StorageStrategy, \
				typename Voidable<DeferredIterator, MapExpressionFunction2<FunctionType, decltype(this->begin()), ConstantIterator<Arg2>>>::Type \
			> result( \
				this->size(), \
				expr, \
				std::random_access_iterator_tag() \
			); \
			return result; \
		}
		// Two argument with arrays
		template<typename Result, typename Item2, typename FunctionType, typename SizeInfo2, template<typename,typename> class StorageStrategy2, typename DeferredIterator2>
		auto map(FunctionType fn, const ArrayBase<Item2, SizeInfo2, StorageStrategy2, DeferredIterator2> &arg2) const \
			-> Array< \
				Result, SizeMinimum<SizeInfo, SizeInfo2>, StorageStrategy, \
				typename Voidable2<DeferredIterator, DeferredIterator2, MapExpressionFunction2<FunctionType, decltype(this->begin()), decltype(arg2.begin())>>::Type \
			> \
		{ \
			MapExpressionFunction2<FunctionType, decltype(this->begin()), decltype(arg2.begin())> expr(fn, this->begin(), arg2.begin()); \
			Array< \
				Result, SizeMinimum<SizeInfo, SizeInfo2>, StorageStrategy, \
				typename Voidable2<DeferredIterator, DeferredIterator2, MapExpressionFunction2<FunctionType, decltype(this->begin()), decltype(arg2.begin())>>::Type \
			> result( \
				this->size(), \
				expr, \
				std::random_access_iterator_tag() \
			); \
			return result; \
		}

		// Specific forms for references to raw functions
		template<typename Result>
		auto map(Result (*fn)(Item)) const
			-> decltype(this->map<Result, Result(*)(Item)>(fn))
		{
			return map<Result, Result(*)(Item)>(fn);
		}
		template<typename Result, typename Arg2>
		auto map(Result (*fn)(Item, Arg2), const Arg2 &arg2) const
			-> decltype(this->map<Result, Arg2, Result(*)(Item, Arg2)>(fn, arg2))
		{
			return this->map<Result, Arg2, Result(*)(Item, Arg2)>(fn, arg2);
		}
		template<typename Result, typename Arg2>
		auto map(Result (*fn)(Item, decltype(*std::declval<Arg2>().begin())), const Arg2 &arg2) const
			-> decltype(this->map<Result, Arg2, Result(*)(Item, decltype(*std::declval<Arg2>().begin()))>(fn, arg2))
		{
			return this->map<Result, Arg2, Result(*)(Item, decltype(*std::declval<Arg2>().begin()))>(fn, arg2);
		}

		// Explicit map, where function is in template
		template<typename Result, Result(*Func)(Item)>
		auto mapExplicit() const \
			-> Array< \
				Result, SizeInfo, StorageStrategy, \
				typename Voidable<DeferredIterator, MapExpressionExplicit<Result, Item, Func, decltype(this->begin())>>::Type \
			> \
		{ \
			MapExpressionExplicit<Result, Item, Func, decltype(this->begin())> expr(this->begin()); \
			Array< \
				Result, SizeInfo, StorageStrategy, \
				typename Voidable<DeferredIterator, MapExpressionExplicit<Result, Item, Func, decltype(this->begin())>>::Type \
			> result( \
				this->size(), \
				expr, \
				std::random_access_iterator_tag() \
			); \
			return result; \
		}
		// Two-argument with scalar
		template<typename Result, typename Arg2, Result(*Func)(Item, Arg2)>
		auto mapExplicit(const Arg2 &arg2) const \
			/* Only support for non-array Arg2 */ \
			-> typename std::enable_if<!is_numeric_array<Arg2>::value, \
				Array< \
					Result, SizeInfo, StorageStrategy, \
					typename Voidable<DeferredIterator, MapExpressionExplicit2<Result, Item, Arg2, Func, decltype(this->begin()), ConstantIterator<Arg2>>>::Type \
				> \
			>::type \
		{ \
			MapExpressionExplicit2<Result, Item, Arg2, Func, decltype(this->begin()), ConstantIterator<Arg2>> expr(this->begin(), ConstantIterator<Arg2>(arg2)); \
			Array< \
				Result, SizeInfo, StorageStrategy, \
				typename Voidable<DeferredIterator, MapExpressionExplicit2<Result, Item, Arg2, Func, decltype(this->begin()), ConstantIterator<Arg2>>>::Type \
			> result( \
				this->size(), \
				expr, \
				std::random_access_iterator_tag() \
			); \
			return result; \
		}
		// Two-argument with arrays
		template<typename Result, typename Item2, Result(*Func)(Item, Item2), typename SizeInfo2, template<typename,typename> class StorageStrategy2, typename DeferredIterator2>
		auto mapExplicit(const ArrayBase<Item2, SizeInfo2, StorageStrategy2, DeferredIterator2> &arg2) const \
			-> Array< \
				Result, SizeMinimum<SizeInfo, SizeInfo2>, StorageStrategy, \
				typename Voidable2<DeferredIterator, DeferredIterator2, MapExpressionExplicit2<Result, Item, Item2, Func, decltype(this->begin()), decltype(arg2.begin())>>::Type \
			> \
		{ \
			MapExpressionExplicit2<Result, Item, Item2, Func, decltype(this->begin()), decltype(arg2.begin())> expr(this->begin(), arg2.begin()); \
			Array< \
				Result, SizeInfo, StorageStrategy, \
				typename Voidable2<DeferredIterator, DeferredIterator2, MapExpressionExplicit2<Result, Item, Item2, Func, decltype(this->begin()), decltype(arg2.begin())>>::Type \
			> result( \
				this->size(), \
				expr, \
				std::random_access_iterator_tag() \
			); \
			return result; \
		}

#define NUMERIC_BINARY_MAP_EXPR(explicitFunc, Item, OtherItem, arg) \
	/* Use the .mapExplicit() template, deriving the return type with decltype() */ \
		this->template mapExplicit<decltype(explicitFunc(std::declval<Item>(), std::declval<OtherItem>())), OtherItem, explicitFunc>(arg)
#define NUMERIC_BINARY_MAP_LEFTEXPR(explicitFunc, obj, Item, OtherItem, arg) \
	/* Use the .mapExplicit() template, deriving the return type with decltype() */ \
		obj.template mapExplicit<decltype(explicitFunc(std::declval<Item>(), std::declval<OtherItem>())), OtherItem, explicitFunc>(arg)
#define NUMERIC_BINARY_METHODS(explicitFunc, flipFunc, funcName, UNPACK_OR_IGNORE) \
		template<typename OtherItem, typename OtherSize, template<typename,typename> class OtherStrategy, typename OtherDeferred> \
		auto	funcName (const ArrayBase<OtherItem, OtherSize, OtherStrategy, OtherDeferred> &other) const \
			-> decltype(NUMERIC_BINARY_MAP_EXPR(explicitFunc, Item, OtherItem, other)) \
		{ \
			return NUMERIC_BINARY_MAP_EXPR(explicitFunc, Item, OtherItem, other); \
		} \
		/* Enable operator with scalar, but only for non-array types */ \
		template<typename OtherItem> \
		auto funcName (const OtherItem &other) const \
			-> decltype(NUMERIC_BINARY_MAP_EXPR(explicitFunc, Item, OtherItem, other)) \
		{ \
			return NUMERIC_BINARY_MAP_EXPR(explicitFunc, Item, OtherItem, other); \
		} \
		// /* Optional friend function for left-operator */ \
		// UNPACK_OR_IGNORE( \
		// 	template<typename LeftItem, typename RightItem, typename RightSize, template<typename,typename> class RightStrategy, typename RightDeferred> \
		// 	friend auto funcName (const LeftItem &left, const Array<RightItem, RightSize, RightStrategy, RightDeferred> &right) \
		// 		-> decltype(NUMERIC_BINARY_MAP_LEFTEXPR(flipFunc, right, RightItem, LeftItem, left)) \
		// 	{ \
		// 		return NUMERIC_BINARY_MAP_LEFTEXPR(flipFunc, right, RightItem, LeftItem, left); \
		// 	} \
		// )
#define NUMERIC_BINARY_OP(Suffix, Operator, method, ENABLE_LEFT_FUNCTION) \
		NUMERIC_BINARY_METHODS(operators::binaryRight##Suffix, operators::binaryLeft##Suffix, method, ENABLE_LEFT_FUNCTION)

		NUMERIC_BINARY_OP(Plus, +, operator +, NUMERIC_UNPACK)
		NUMERIC_BINARY_OP(Minus, -, operator -, NUMERIC_UNPACK)
		NUMERIC_BINARY_OP(Multiply, *, operator *, NUMERIC_UNPACK)
		NUMERIC_BINARY_OP(Divide, /, operator /, NUMERIC_UNPACK)
		NUMERIC_BINARY_OP(Modulo, %, operator %, NUMERIC_UNPACK)

		NUMERIC_BINARY_OP(BitAnd, &, operator &, NUMERIC_UNPACK)
		NUMERIC_BINARY_OP(BitOr, |, operator |, NUMERIC_UNPACK)
		NUMERIC_BINARY_OP(BitXor, ^, operator ^, NUMERIC_UNPACK)
		NUMERIC_BINARY_OP(ShiftLeft, <<, operator <<, NUMERIC_UNPACK)
		NUMERIC_BINARY_OP(ShiftRight, >>, operator >>, NUMERIC_UNPACK)

		// Verbose method names for boolean comparisons - skip the left-scalar version by using NUMERIC_IGNORE
		NUMERIC_BINARY_OP(Equal, ==, equal, NUMERIC_IGNORE)
		NUMERIC_BINARY_OP(NotEqual, !=, notEqual, NUMERIC_IGNORE)
		NUMERIC_BINARY_OP(GreaterThan, >, greaterThan, NUMERIC_IGNORE)
		NUMERIC_BINARY_OP(LessThan, <, lessThan, NUMERIC_IGNORE)
		NUMERIC_BINARY_OP(GreaterThanEqual, >=, greaterThanEqual, NUMERIC_IGNORE)
		NUMERIC_BINARY_OP(LessThanEqual, <=, lessThanEqual, NUMERIC_IGNORE)
#ifdef __cpp_impl_three_way_comparison
		NUMERIC_BINARY_OP(Compare, <=>, compare, NUMERIC_IGNORE)
#endif
		NUMERIC_BINARY_OP(BoolAnd, &&, boolAnd, NUMERIC_IGNORE)
		NUMERIC_BINARY_OP(BoolOr, ||, boolOr, NUMERIC_IGNORE)

		// Implicit operators
#ifndef NUMERIC_NO_BOOLEAN_OPS
		NUMERIC_BINARY_OP(Equal, ==, operator ==, NUMERIC_UNPACK)
		NUMERIC_BINARY_OP(NotEqual, !=, operator !=, NUMERIC_UNPACK)
		NUMERIC_BINARY_OP(GreaterThan, >, operator >, NUMERIC_UNPACK)
		NUMERIC_BINARY_OP(LessThan, <, operator <, NUMERIC_UNPACK)
		NUMERIC_BINARY_OP(GreaterThanEqual, >=, operator >=, NUMERIC_UNPACK)
		NUMERIC_BINARY_OP(LessThanEqual, <=, operator <=, NUMERIC_UNPACK)
#ifdef __cpp_impl_three_way_comparison
		NUMERIC_BINARY_OP(Compare, <=>, operator <=>, NUMERIC_UNPACK)
#endif
		NUMERIC_BINARY_OP(BoolAnd, &&, operator &&, NUMERIC_UNPACK)
		NUMERIC_BINARY_OP(BoolOr, ||, operator ||, NUMERIC_UNPACK)
#endif
	};

	/* Intermediate SFINAE classes for unary operators

	Binary operators are templated by the other operand, so it won't try and generate invalid
	code (e.g. adding together incompatible types) unless the user writes an equivalent expression.

	Unary operators are _not_ templated, so if we define them for an incompatible underlying
	type, then we get compile errors.

	The solution is for each unary operator to have a separate class in the inheritance sequence.
	We switch between two possible versions of the class (empty, or with the method defined)
	using SFINAE techniques.

	SFINAE: Substitution Failure Is Not An Error

		The decltype() operator introduced in C++11 lets us derive the type of an expression,
		much like "auto" does.  However, it's possible to put an expression in there which is
		valid for some types and not others (e.g. when a certain operator/method isn't there).

		If this happens in the body of the code, it's a compile error - but if it happens during
		the template-matching step, then that template is just skipped.  So, we can define a
		specialisation using decltype() with the unary operator in question, which will fail
		(and therefore skip that specialisation) if the underlying type doesn't support it.

	*/
#define NUMERIC_INTERMEDIATE_CLASS(SubClass, BaseClass, testExpression, classBody) \
	/* Default class just passes through, without adding anything.  Note the final parameter, which is always void. */ \
	template<typename Item, typename SizeInfo, template<typename,typename> class StorageStrategy, typename DeferredIterator, typename=void> \
	struct SubClass : public BaseClass<Item, SizeInfo, StorageStrategy, DeferredIterator> {	\
		using BaseClass<Item, SizeInfo, StorageStrategy, DeferredIterator>::BaseClass; \
	}; \
	/* If {testExpression} produces a valid type (i.e. the operator is supported), then the
	decltype() for the final parameter will produce the type "void", so this specialisation will be used. */ \
	template<typename Item, typename SizeInfo, template<typename,typename> class StorageStrategy, typename DeferredIterator> \
	struct SubClass<Item, SizeInfo, StorageStrategy, DeferredIterator, decltype((void)testExpression)>: public BaseClass<Item, SizeInfo, StorageStrategy, DeferredIterator> { \
		using BaseClass<Item, SizeInfo, StorageStrategy, DeferredIterator>::BaseClass; \
		\
		/* Body should arrive wrapped in brackets (to prevent comma-ambiguities), this unpacks it again */ \
		NUMERIC_UNPACK classBody \
	};

#define NUMERIC_UNARY_MAP_EXPR(explicitFunc) \
	/* Use the .mapExplicit() template, deriving the return type with decltype() */ \
	this->template mapExplicit<decltype(explicitFunc(std::declval<Item>())), explicitFunc>()
#define NUMERIC_UNARY_INTERMEDIATE(SubClass, BaseClass, explicitFunc, method, UNPACK_OR_IGNORE) \
	NUMERIC_INTERMEDIATE_CLASS(SubClass, BaseClass, explicitFunc(std::declval<Item>()), ( \
		UNPACK_OR_IGNORE ( \
			using ArrayWithBinaryOperators<Item, SizeInfo, StorageStrategy, DeferredIterator>::method; \
		) \
		auto method() const -> decltype(NUMERIC_UNARY_MAP_EXPR(explicitFunc)) { \
			return NUMERIC_UNARY_MAP_EXPR(explicitFunc); \
		} \
	))

	// Create intermediate SFINAE classes for each of the unary operators
	NUMERIC_UNARY_INTERMEDIATE(ArrayWithUnaryPlus, ArrayWithBinaryOperators, operators::unaryPlus, operator +, NUMERIC_UNPACK)
	NUMERIC_UNARY_INTERMEDIATE(ArrayWithUnaryMinus, ArrayWithUnaryPlus, operators::unaryMinus, operator -, NUMERIC_UNPACK)
	NUMERIC_UNARY_INTERMEDIATE(ArrayWithUnaryNot, ArrayWithUnaryMinus, operators::unaryNot, operator !, NUMERIC_IGNORE)
	NUMERIC_UNARY_INTERMEDIATE(ArrayWithUnaryBitNot, ArrayWithUnaryNot, operators::unaryBitNot, operator ~, NUMERIC_IGNORE)

	template<typename Item, typename SizeInfo, template<typename,typename> class StorageStrategy, typename DeferredIterator>
	struct ArrayReadable : public ArrayWithUnaryBitNot<Item, SizeInfo, StorageStrategy, DeferredIterator> {
		using ArrayWithUnaryBitNot<Item, SizeInfo, StorageStrategy, DeferredIterator>::ArrayWithUnaryBitNot;

		auto slice(size_t start, size_t size, int stride=1)
			-> Array<Item, SizeMinimum<SizeInfo, SizeFinite<1>>, StorageStrategy, SliceIterator<decltype(this->begin())>>
		{
			return Array<Item, SizeMinimum<SizeInfo, SizeFinite<1>>, StorageStrategy, SliceIterator<decltype(this->begin())>>(size, SliceIterator<decltype(this->begin())>(this->begin() + start, stride), std::random_access_iterator_tag());
		}
		template<size_t fixedStride>
		auto slice(size_t start=0)
			-> Array<Item, SizeDivide<SizeInfo, fixedStride>, StorageStrategy, SliceIterator<decltype(this->begin())>>
		{
			return Array<Item, SizeDivide<SizeInfo, fixedStride>, StorageStrategy, SliceIterator<decltype(this->begin())>>(this->size()/fixedStride, SliceIterator<decltype(this->begin())>(this->begin() + start, fixedStride), std::random_access_iterator_tag());
		}
	};

	/* Final Array class

	The generic implementation is the "deferred calculation" mode, where no non-const methods are allowed

	The DeferredIterator=void case contains methods/ops which change values.
	These have to be in the bottom-level class, so they can return references of the correct type.

	*/
	template<typename Item, typename SizeInfo, template<typename,typename> class StorageStrategy, typename DeferredIterator>
	class ArrayConstructible : public ArrayReadable<Item, SizeInfo, StorageStrategy, DeferredIterator> {
		using Super = ArrayReadable<Item, SizeInfo, StorageStrategy, DeferredIterator>;
	public:
		using Super::ArrayReadable;
	};

	template<typename Item, typename SizeInfo, template<typename,typename> class StorageStrategy>
	class ArrayConstructible<Item, SizeInfo, StorageStrategy, void> : public ArrayReadable<Item, SizeInfo, StorageStrategy, void> {
		using Super = ArrayReadable<Item, SizeInfo, StorageStrategy, void>;
	public:
		using ArrayReadable<Item, SizeInfo, StorageStrategy, void>::ArrayReadable;

		// Construct from other types
		ArrayConstructible(const std::initializer_list<Item> &init) : Super(init.size(), std::begin(init), std::input_iterator_tag()) {}
		template<typename OtherItem, size_t size>
		ArrayConstructible(const OtherItem (&init)[size]) : Super(size, &init[0], std::random_access_iterator_tag()) {}
		template<typename OtherItem, size_t size>
		ArrayConstructible(const std::array<OtherItem, size>& init) : Super(size, &init[0], std::random_access_iterator_tag()) {}
		template<typename OtherItem>
		ArrayConstructible(const std::vector<OtherItem>& init) : Super(init.size(), init.begin(), std::random_access_iterator_tag()) {}

		// Construct from another array of the same size
		ArrayConstructible(const ArrayConstructible<Item, SizeInfo, StorageStrategy, void> &other) : Super(other.size(), other.begin(), std::random_access_iterator_tag()) {}
		template<typename OtherItem, template<typename,typename> class OtherStrategy, typename OtherDeferred>
		ArrayConstructible(const Array<OtherItem, SizeInfo, OtherStrategy, OtherDeferred> &other) : Super(other.size(), other.begin(), std::random_access_iterator_tag()) {}

		template<typename OtherItem, typename OtherSize, template<typename,typename> class OtherStrategy, typename OtherDeferred>
		ArrayConstructible(const Array<OtherItem, OtherSize, OtherStrategy, OtherDeferred> &other) : Super(other.size(), other.begin(), std::random_access_iterator_tag()) {}
	};

	// SFINAE detection on whether it's writeable or not
	template<typename Item, typename SizeInfo, template<typename,typename> class StorageStrategy, typename DeferredIterator, typename>
	class ArrayWriteable : public ArrayConstructible<Item, SizeInfo, StorageStrategy, DeferredIterator> {
	public:
		using ArrayConstructible<Item, SizeInfo, StorageStrategy, DeferredIterator>::ArrayConstructible;
	};

	template<typename Item, typename SizeInfo, template<typename,typename> class StorageStrategy, typename DeferredIterator>
	class ArrayWriteable<Item, SizeInfo, StorageStrategy, DeferredIterator, decltype(
		// SFINAE test for assignability
		(void)(std::declval<ArrayConstructible<Item, SizeInfo, StorageStrategy, DeferredIterator>>()[0]
			= std::declval<ArrayConstructible<Item, SizeInfo, StorageStrategy, DeferredIterator>>()[0])
	)> : public ArrayConstructible<Item, SizeInfo, StorageStrategy, DeferredIterator> {
	public:
		using ArrayConstructible<Item, SizeInfo, StorageStrategy, DeferredIterator>::ArrayConstructible;

		ArrayWriteable & operator=(const ArrayWriteable<Item, SizeInfo, StorageStrategy, DeferredIterator> &other) {
			this->assign(other.size(), other.begin(), std::random_access_iterator_tag());
			return *this;
		}
		// Assign from another array, of any size
		template<typename OtherItem, typename OtherSize, template<typename,typename> class OtherStrategy, typename OtherDeferred>
		ArrayWriteable & operator=(const ArrayBase<OtherItem, OtherSize, OtherStrategy, OtherDeferred> &other) {
			this->assign(other.size() , other.begin(), std::random_access_iterator_tag());
			return *this;
		}
		// We might be able to steal their storage
		ArrayWriteable & operator=(ArrayBase<Item, SizeInfo, StorageStrategy, void> &&other) {
			this->assign(other);
			return *this;
		}
		template<size_t fixedSize, typename OtherItem>
		ArrayWriteable & operator=(OtherItem (&arr)[fixedSize]) {
			this->assign(fixedSize, &arr[0], std::random_access_iterator_tag());
			return *this;
		}
		ArrayWriteable & operator=(std::initializer_list<Item> init) {
			this->assign(init.size(), init.begin(), std::random_access_iterator_tag());
			return *this;
		}

		ArrayWriteable & fill(const Item &value) {
			for (size_t i = 0; i < this->size(); i++) {
				(*this)[i] = value;
			}
			return *this;
		}
		NUMERIC_ASSIGNMENT_OP(+=, operator +=)
		NUMERIC_ASSIGNMENT_OP(-=, operator -=)
		NUMERIC_ASSIGNMENT_OP(*=, operator *=)
		NUMERIC_ASSIGNMENT_OP(/=, operator /=)
		NUMERIC_ASSIGNMENT_OP(%=, operator %=)
		NUMERIC_ASSIGNMENT_OP(&=, operator &=)
		NUMERIC_ASSIGNMENT_OP(|=, operator |=)
		NUMERIC_ASSIGNMENT_OP(^=, operator ^=)
		NUMERIC_ASSIGNMENT_OP(<<=, operator <<=)
		NUMERIC_ASSIGNMENT_OP(>>=, operator >>=)

		auto defer() const -> const Array<Item, SizeInfo, StorageStrategy, decltype(this->begin())> {
			return Array<Item, SizeInfo, StorageStrategy, decltype(this->begin())>(this->size(), this->begin(), std::random_access_iterator_tag());
		}
	};

	template<typename Iterator>
	Array<typename std::remove_reference<decltype(std::declval<Iterator>()[0])>::type, SizeFinite<1>, DirectStrategy, Iterator> wrap(Iterator iter, size_t size) {
		return Array<typename std::remove_reference<decltype(std::declval<Iterator>()[0])>::type, SizeFinite<1>, DirectStrategy, Iterator>(size, iter, std::random_access_iterator_tag());
	}

	template<size_t fixedSize, typename Iterator>
	Array<typename std::remove_reference<decltype(std::declval<Iterator>()[0])>::type, SizeFixed<fixedSize>, DirectStrategy, Iterator> wrap(Iterator iter) {
		return Array<typename std::remove_reference<decltype(std::declval<Iterator>()[0])>::type, SizeFixed<fixedSize>, DirectStrategy, Iterator>(fixedSize, iter, std::random_access_iterator_tag());
	}

	template<size_t fixedSize, typename Item>
	Array<Item, SizeFixed<fixedSize>, DirectStrategy, Item*> wrap(Item (&item)[fixedSize]) {
		return Array<Item, SizeFixed<fixedSize>, DirectStrategy, Item*>(fixedSize, &item[0], std::random_access_iterator_tag());
	}

	template<typename Value=int>
	Array<Value, SizeFinite<1>, DirectStrategy, RangeIterator<Value>> range(size_t size) {
		Array<Value, SizeFinite<1>, DirectStrategy, RangeIterator<Value>> rangeArray(size, 0, std::random_access_iterator_tag());
		return rangeArray;
	}

	template<typename Item, size_t size>
	using FixedArray = Array<Item, SizeFixed<size>, DirectStrategy, void>;

	template<typename Item, size_t sizeMax, size_t sizeDivisor=1>
	using BoundedArray = Array<Item, SizeBounded<sizeMax, sizeDivisor>, DirectStrategy, void>;

	template<typename Item, size_t sizeDivisor=1>
	using FreeArray = Array<Item, SizeFinite<sizeDivisor>, DirectStrategy, void>;

} // End of numeric namespace

/* Overload some unqualified numerical functions */
#define NUMERIC_UNARY_FUNCTION(func) \
	template<typename Item, typename SizeInfo, template<typename,typename> class StorageStrategy, typename DeferredIterator> \
	auto func(const NUMERIC_NAMESPACE::Array<Item, SizeInfo, StorageStrategy, DeferredIterator> &array) \
		-> decltype(array.template mapExplicit<decltype(func(std::declval<Item>())), func>()) \
	{ \
		return array.template mapExplicit<decltype(func(std::declval<Item>())), func>(); \
	}

#define NUMERIC_BINARY_FUNCTION(func) \
	template< \
		typename Item, typename SizeInfo, template<typename,typename> class StorageStrategy, typename DeferredIterator, \
		typename OtherItem, typename OtherSize, template<typename,typename> class OtherStrategy, typename OtherDeferred \
	> \
	auto func( \
		const NUMERIC_NAMESPACE::Array<Item, SizeInfo, StorageStrategy, DeferredIterator> &array, \
		const NUMERIC_NAMESPACE::Array<OtherItem, OtherSize, OtherStrategy, OtherDeferred> &other \
	) -> decltype(array.template mapExplicit<decltype(func(std::declval<Item>(), std::declval<OtherItem>())), OtherItem, func>(other)) \
	{ \
		return array.template mapExplicit<decltype(func(std::declval<Item>(), std::declval<OtherItem>())), OtherItem, func>(other); \
	} \
	/* with scalar */ \
	template< \
		typename Item, typename SizeInfo, template<typename,typename> class StorageStrategy, typename DeferredIterator, \
		typename Other \
	> \
	auto func( \
		const NUMERIC_NAMESPACE::Array<Item, SizeInfo, StorageStrategy, DeferredIterator> &array, \
		const Other &other \
	) -> typename std::enable_if<!NUMERIC_NAMESPACE::is_numeric_array<Other>::value, \
		decltype(array.template mapExplicit<decltype(func(std::declval<Item>(), std::declval<Other>())), Other, func>(other)) \
	>::type \
	{ \
		return array.template mapExplicit<decltype(func(std::declval<Item>(), std::declval<Other>())), Other, func>(other); \
	} \
	/* left scalar */ \
	namespace NUMERIC_NAMESPACE { \
		namespace funcs { \
			template<typename Left, typename Right> \
			auto flip_##func(Left left, Right right) -> decltype(func(right, left)) { \
				return func(right, left); \
			} \
		} \
	} \
	template< \
		typename Other, \
		typename Item, typename SizeInfo, template<typename,typename> class StorageStrategy, typename DeferredIterator \
	> \
	auto func( \
		const Other &other, \
		const NUMERIC_NAMESPACE::Array<Item, SizeInfo, StorageStrategy, DeferredIterator> &array \
	) -> typename std::enable_if<!NUMERIC_NAMESPACE::is_numeric_array<Other>::value, \
		decltype(array.template mapExplicit<decltype(NUMERIC_NAMESPACE::funcs::flip_##func(std::declval<Item>(), std::declval<Other>())), Other, NUMERIC_NAMESPACE::funcs::flip_##func>(other)) \
	>::type \
	{ \
		return array.template mapExplicit<decltype(NUMERIC_NAMESPACE::funcs::flip_##func(std::declval<Item>(), std::declval<Other>())), Other, NUMERIC_NAMESPACE::funcs::flip_##func>(other); \
	}

NUMERIC_UNARY_FUNCTION(abs)

NUMERIC_UNARY_FUNCTION(exp)
NUMERIC_UNARY_FUNCTION(log)
NUMERIC_UNARY_FUNCTION(log10)

NUMERIC_BINARY_FUNCTION(pow)
NUMERIC_UNARY_FUNCTION(sqrt)

NUMERIC_UNARY_FUNCTION(sin)
NUMERIC_UNARY_FUNCTION(cos)
NUMERIC_UNARY_FUNCTION(tan)
NUMERIC_UNARY_FUNCTION(asin)
NUMERIC_UNARY_FUNCTION(acos)
NUMERIC_UNARY_FUNCTION(atan)
NUMERIC_BINARY_FUNCTION(atan2)

NUMERIC_UNARY_FUNCTION(sinh)
NUMERIC_UNARY_FUNCTION(cosh)
NUMERIC_UNARY_FUNCTION(tanh)

#undef NUMERIC_BINARY_TYPE
#undef NUMERIC_UNARY_TYPE
#undef NUMERIC_BINARY_ARRAY
#undef NUMERIC_BINARY_OP
#undef NUMERIC_UNARY_OP
#undef NUMERIC_ASSIGNMENT_OP

#endif // Include guard