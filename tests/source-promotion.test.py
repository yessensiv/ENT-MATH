import importlib.util,pathlib,unittest
spec=importlib.util.spec_from_file_location('promotion',pathlib.Path(__file__).parents[1]/'scripts/promote-source-exercises.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class PromotionTests(unittest.TestCase):
    def test_precedence_fraction_negative_exponent_and_absolute_value(self):
        cases={r'2+8(6+1)':'58',r'-2^2':'-4',r'(-2)^2':'4',r'2^{-3}':'1/8',r'\frac{1}{2}+\frac{1}{3}':'5/6',r'\frac{2+3}{7-2}':'1',r'|-3|+2':'5',r'\sqrt{81}':'9'}
        for source,answer in cases.items():self.assertEqual(str(m.Formula(source).value),answer,source)
    def test_unsupported_input_fails_closed(self):
        for source in ['__import__("os").system("whoami")','1/0','2^9999999','1 2','x+y',r'\sqrt{2}',r'\unknown{2}','(2+3','1e6']:
            with self.assertRaises(m.Unsupported,msg=source):m.Formula(source)
    def test_domain_survives_cancellation(self):
        result=m.equation(r'\frac{x-1}{x-1}=x','solve each rational equation')
        self.assertEqual(result[2],'∅')
    def test_two_roots_and_known_wrong_source_key(self):
        result=m.equation('2*x^2-7*x+3=0','solve each equation')
        self.assertEqual(result[2],'{1/2;3}')
        self.assertIn('Проверка x=1/2',str(result[3]))
    def test_specific_instructions_and_multiple_variables_not_reinterpreted(self):
        for source,context in [('x+2=5','graph the function'),('x^2=4','solve using the square root property'),('a=b+2','solve')]:
            with self.assertRaises(m.Unsupported):m.equation(source,context)
    def test_inequality_endpoints_and_holes(self):
        cases={r'\frac{x-3}{x+4}\geq0':'(-inf;-4)U[3;+inf)',r'-2x<4':'(-2;+inf)',r'\frac{x-1}{x-1}>0':'(-inf;1)U(1;+inf)',r'x^2+1<0':'∅'}
        for source,answer in cases.items():self.assertEqual(m.inequality(source,'solve each inequality')[2],answer)
    def test_topic_is_not_generic_numbers(self):
        for tex,topic in [(r'\frac{1}{2}+\frac{2}{3}','fractions'),('-3+2','negatives'),('1.2+0.7','school-decimals'),('|-5|','school-absolute-value')]:
            self.assertEqual(m.numeric(tex,'simplify',{'url':'example.org/Order_of_Operations'})[0],topic)

if __name__=='__main__':unittest.main()
